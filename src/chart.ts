import Line from './line';
import { minmax, interpolate, InterpolationFunction, animation, AnimationCallback } from './utils';
import Brush, { BrushChangeEvent } from './brush';
import YAxis from './y-axis';
import XAxis from './x-axis';
import Legend, { LegendChangeEvent } from './legend';
import Monitor from './monitor';
import render from './render';
import { X_TYPE, LINE_TYPE, CHART_PADDING, Y_AXIS_ANIMATION_DURATION, BRUSH_HEIGHT, WIDTH_HEIGHT_RATIO } from './constants';

export type Viewport = {
    width: number,
    height: number
};

export type ChartColumn = Array<string|number>;

export type ChartDataObject = {
    columns: ChartColumn[],
    types: {
        [name: string]: string;
    },
    names: {
        [name: string]: string;
    },
    colors: {
        [name: string]: string;
    }
};

export type ChartOptions = {
    container: HTMLElement | null;
    data: ChartDataObject;
    title?: string;
    width?: number;
    height?: number;
};

export default class Chart {

    container: HTMLElement;
    popover: HTMLElement;
    popoverDate: HTMLElement;
    popoverValues: HTMLElement;
    chartCursor: HTMLElement;

    viewportRect: DOMRect | ClientRect;

    data: ChartDataObject;

    context: CanvasRenderingContext2D[];

    width: number;
    height: number;

    interpolateX: InterpolationFunction;
    
    lines: Line[];
    brushLines: Line[];

    brush: Brush;
    yAxis: YAxis;
    xAxis: XAxis;
    legend: Legend;

    _maxValueAnimation?: AnimationCallback;
    _currentMaxValueAnimation?: AnimationCallback;

    private _prevMax?: number;
    private _prevCurrentMax?: number;

    constructor(private options: ChartOptions) {
        if (options.container === null) {
            throw new Error(`container options is mandatory`);
        }
        this.container = options.container;
        this.data = options.data;
        this.context = [];
        this.width = options.width || this.getContainerWidth() || 0;
        this.height = options.height || ((this.width * WIDTH_HEIGHT_RATIO) | 0) || 0;
        this.lines = [];
        this.brushLines = [];

        this.interpolateX = interpolate(0, this.width);

        const { title } = this.options;

        this.container.classList.add('tgc-chart');
        this.container.innerHTML = `
            <div class="tgc-chart__title">${ title || `Unnamed Chart` }</div>
            <div class="tgc-viewport">
                <div class="tgc-lines"></div>
                <div class="tgc-cursor"></div>
                <div class="tgc-popover">
                    <div class="tgc-popover__date">Sat, Feb 24</div>
                    <div class="tgc-popover__values">
                        <div class="tgc-popover__value">
                            <div class="tgc-popover__number">167</div>
                            <div class="tgc-popover__name">Joined</div>
                        </div>
                        <div class="tgc-popover__value">
                            <div class="tgc-popover__number">98</div>
                            <div class="tgc-popover__name">Left</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (options.width) {
            this.container.style.width = `${options.width}px`;
        }
        if (options.height) {
            this.container.style.height = `${options.height}px`;
        }

        
        this.popover = this.find('.tgc-popover');
        this.popoverDate = this.find('.tgc-popover__date');
        this.popoverValues = this.find('.tgc-popover__values');
        this.chartCursor = this.find('.tgc-cursor');


        const monitor = new Monitor({});
        // monitor.appendTo(this.container);

        const linesContainer = this.find('.tgc-lines');
        const viewportContainer = this.find('.tgc-viewport');

        // 
        // Get viewport size
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.viewportRect = viewportContainer.getBoundingClientRect();
        const { top, left, right, bottom } = this.viewportRect;
        const viewport = {
            width: (right - left) || this.width,
            height: (bottom - top) || this.height
        };

        viewportContainer.addEventListener('mouseenter', this.handleMouseEnter.bind(this));
        viewportContainer.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        viewportContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));

        
        // 
        // Create brush and append to container
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.brush = new Brush({
            chart: this,
            monitor
        });

        // 
        // X Axis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.xAxis = new XAxis({
            chart: this
        });

        // 
        // Legend
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.legend = new Legend({
            data: this.data
        });
        this.legend.on('change', this.handleLegendChange.bind(this));


        this.xAxis.appendTo(this.container);
        this.brush.appendTo(this.container);
        this.legend.appendTo(this.container);



        let xData: number[] = [];
        




        for (let i = 0; i < this.data.columns.length; i++) {
            const column = this.data.columns[i];
            const [alias, ...dataArray] = column;
            const data = dataArray as number[]; //new Int32Array(dataArray as number[]);
            const type = this.data.types[alias];
            if (type === X_TYPE) {
                xData = data;
                continue;
            }
            const name = this.data.names[alias];
            const color = this.data.colors[alias];

            const options = {
                chart: this,
                alias: alias as string,
                name,
                color,
                data,
                width: viewport.width,
                height: viewport.height,
                className: "tgc-line",
                isBrush: false,
                monitor
            };

            const line = new Line(options);
            this.lines.push(line);

            const brushLine = new Line({
                ...options,
                height: BRUSH_HEIGHT,
                className: "tgc-brush__line",
                isBrush: true
            });
            this.brushLines.push(brushLine);
        }

        linesContainer.append(...this.lines.map(line => line.getContainer()));

        this.xAxis.addData(xData);

        this.brush.addLines(this.brushLines);
        this.brush.on('change', this.handleWindowChange.bind(this));

        // 
        // YAxis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.yAxis = new YAxis({
            chart: this,
            viewport
        });
        this.yAxis.appendTo(viewportContainer);

        (window as any).render = this.handleWindowChange.bind(this);

        this.lines.forEach(line => line.render());
        this.brushLines.forEach(line => line.render());
        this.xAxis.render();
    }

    render(recursive: boolean = false) {
        if (recursive && !this._maxValueAnimation && !this._currentMaxValueAnimation && !this.brush.hasAnimation()) {
            return;
        }
        render('chart lines render', () => {            
            this.lines.forEach(line => line.render());
            this.brushLines.forEach(line => line.render());
            this.render(true); // TODO ?
        });
    }

    handleWindowChange() {
        // console.log('handleWindowChange');
        this.render();
    }

    handleLegendChange(event: LegendChangeEvent) {
        console.log(event.alias, event.state);
        const line = this.getLine(this.lines, event.alias);
        line[event.state ? 'show' : 'hide']();
        const brushLine = this.getLine(this.brushLines, event.alias);
        brushLine[event.state ? 'show' : 'hide']();
        this.render();
        // render('chart brush lines render', () => {
        //     this.brushLines.forEach(line => line.render());
        // });
    }

    handleMouseEnter() {
        render('show popover', () => {
            this.popover.style.opacity = '1';
            this.chartCursor.style.opacity = '1';
        });
    }

    handleMouseLeave() {
        render('hide popover', () => {
            this.popover.style.opacity = '0';
            this.chartCursor.style.opacity = '0';
        });
    }

    handleMouseMove(e: MouseEvent) {
        render('move popover', () => {
            const { exact: { startWith, endAt, length } } = this.brush.getWindow();
            const int = interpolate(startWith, endAt);
            const point = Math.round(int((e.clientX - this.viewportRect.left) / this.width));
            const dateString = this.xAxis.getDate(point);
            const values = this.lines.map(line => {
                line.showPoint(point);
                return {
                    name: line.name,
                    value: line.data[point]
                }
            });
            this.popoverDate.innerHTML = dateString;
            let html = '';
            values.forEach(value => {
                html += `
                    <div class="tgc-popover__value">
                        <div class="tgc-popover__number">${value.value}</div>
                        <div class="tgc-popover__name">${value.name}</div>
                    </div>
                `;
            });
            this.popoverValues.innerHTML = html;

            const px = this.interpolateX((point - startWith) / length);

            const { left: popoverLeft, right: popoverRight } = this.popover.getBoundingClientRect();
            const width = popoverRight - popoverLeft;
            const half = width / 2;
            const x = minmax(CHART_PADDING, px - half, this.width - width - CHART_PADDING);
            this.popover.style.transform = `translateX(${x}px)`;

            this.chartCursor.style.transform = `translateX(${Math.round(minmax(1, px, this.width - 1))}px)`
        });
    }

    getLine(lines: Line[], alias: string) {
        const line = lines.find(line => line.alias === alias);
        if (!line) {
            throw new Error('Line is not found');
        }
        return line;
    }

    getContainerWidth(): number {
        const { width } = this.container.getBoundingClientRect();
        return width;
    }

    getMax() {
        const max = this.getMaxExact();
        if (this._prevMax && this._prevMax !== max) {
            const from = this._maxValueAnimation ? this._maxValueAnimation() : this._prevMax;
            this._maxValueAnimation = animation({
                from, 
                to: max, 
                seconds: Y_AXIS_ANIMATION_DURATION
            });
            this._prevMax = max;
            return this._maxValueAnimation();
        }
        if (this._maxValueAnimation) {
            const value = this._maxValueAnimation();
            if (value === this._prevMax) { // TODO finished?
                delete this._maxValueAnimation;
            }
            return value;
        }
        this._prevMax = max;
        return max;
    }

    getMaxExact() {
        return Math.max(...this.lines.map(line => line.getMax()));
    }

    getMin() {
        return Math.min(...this.lines.map(line => line.getMin()));
    }

    getCurrentMax() {
        const max = this.getCurrentMaxExact();
        if (this._prevCurrentMax && this._prevCurrentMax !== max) {
            const from = this._currentMaxValueAnimation ? this._currentMaxValueAnimation() : this._prevCurrentMax;
            this._currentMaxValueAnimation = animation({
                from, 
                to: max, 
                seconds: Y_AXIS_ANIMATION_DURATION
            });
            this._prevCurrentMax = max;
            return this._currentMaxValueAnimation();
        }
        if (this._currentMaxValueAnimation) {
            const value = this._currentMaxValueAnimation();
            if (value === this._prevCurrentMax) { // TODO finished?
                delete this._currentMaxValueAnimation;
            }
            return value;
        }
        this._prevCurrentMax = max;
        return max;
    }

    getCurrentMaxExact() {
        return Math.max(...this.lines.map(line => line.getCurrentMax()));
    }

    getCurrentMin() {
        return Math.min(...this.lines.map(line => line.getCurrentMin()));
    }

    find(selector: string): HTMLElement {
        const el = this.container.querySelector(selector) as HTMLElement;
        if (el === null) {
            throw new Error('Something went wrong');
        }
        return el;
    }

}