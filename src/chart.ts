import Line from './line';
import { humanNumber, minmax, interpolate, InterpolationFunction, animation, AnimationCallback } from './utils';
import Brush, { BrushChangeEvent } from './brush';
import YAxis from './y-axis';
import XAxis from './x-axis';
import Legend, { LegendChangeEvent } from './legend';
import render from './render';
import { X_TYPE, LINE_TYPE, CHART_PADDING, CHART_POINTS_PADDING_RIGHT, Y_AXIS_ANIMATION_DURATION, BRUSH_HEIGHT, WIDTH_HEIGHT_RATIO } from './constants';

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
    interpolateXWithoutPadding: InterpolationFunction;
    
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
        const self = this;
        if (options.container === null) {
            throw new Error(`container options is mandatory`);
        }
        self.container = options.container;
        self.data = options.data;
        self.context = [];
        self.width = options.width || self.getContainerWidth() || 0;
        self.height = options.height || ((self.width * WIDTH_HEIGHT_RATIO) | 0) || 0;
        self.lines = [];
        self.brushLines = [];

        self.interpolateX = interpolate(0, self.width - CHART_POINTS_PADDING_RIGHT);
        self.interpolateXWithoutPadding = interpolate(0, self.width);

        self.container.classList.add('tgc-chart');
        self.container.innerHTML = `
            <div class="tgc-chart__title">${ self.options.title || `Unnamed Chart` }</div>
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
            self.container.style.width = `${options.width}px`;
        }
        if (options.height) {
            self.container.style.height = `${options.height}px`;
        }
        
        self.popover = self.find('.tgc-popover');
        self.popoverDate = self.find('.tgc-popover__date');
        self.popoverValues = self.find('.tgc-popover__values');
        self.chartCursor = self.find('.tgc-cursor');

        const linesContainer = self.find('.tgc-lines');
        const viewportContainer = self.find('.tgc-viewport');

        // 
        // Get viewport size
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.viewportRect = viewportContainer.getBoundingClientRect();
        const { top, left, right, bottom } = self.viewportRect;
        const viewport = {
            width: (right - left) || self.width,
            height: (bottom - top) || self.height
        };

        viewportContainer.addEventListener('mouseenter', self.handleMouseEnter.bind(self));
        viewportContainer.addEventListener('mouseleave', self.handleMouseLeave.bind(self));
        viewportContainer.addEventListener('mousemove', self.handleMouseMove.bind(self));

        
        // 
        // Create brush and append to container
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.brush = new Brush({
            chart: self
        });

        // 
        // X Axis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.xAxis = new XAxis({
            chart: self
        });

        // 
        // Legend
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.legend = new Legend({
            data: self.data
        });
        self.legend.on('change', self.handleLegendChange.bind(self));


        self.xAxis.appendTo(self.container);
        self.brush.appendTo(self.container);
        self.legend.appendTo(self.container);



        let xData: number[] = [];
        




        for (let i = 0; i < self.data.columns.length; i++) {
            const column = self.data.columns[i];
            const [alias, ...dataArray] = column;
            const data = dataArray as number[]; //new Int32Array(dataArray as number[]);
            const type = self.data.types[alias];
            if (type === X_TYPE) {
                xData = data;
                continue;
            }
            const name = self.data.names[alias];
            const color = self.data.colors[alias];

            const options = {
                chart: self,
                alias: alias as string,
                name,
                color,
                data,
                width: viewport.width,
                height: viewport.height,
                className: "tgc-line",
                isBrush: false
            };

            const line = new Line(options);
            self.lines.push(line);

            const brushLine = new Line({
                ...options,
                height: BRUSH_HEIGHT,
                className: "tgc-brush__line",
                isBrush: true
            });
            self.brushLines.push(brushLine);
        }

        linesContainer.append(...self.lines.map(line => line.getContainer()));

        self.brush.on('change', self.handleWindowChange.bind(self));

        self.brush.addLines(self.brushLines);

        self.xAxis.addData(xData);

        // 
        // YAxis
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        self.yAxis = new YAxis({
            chart: self,
            viewport
        });
        self.yAxis.appendTo(viewportContainer);

        (window as any).render = self.handleWindowChange.bind(self);

        self.lines.forEach(line => line.render());
        self.brushLines.forEach(line => line.render());
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
        this.render();
    }

    handleLegendChange(event: LegendChangeEvent) {
        const line = this.getLine(this.lines, event.alias);
        line[event.state ? 'show' : 'hide']();
        const brushLine = this.getLine(this.brushLines, event.alias);
        brushLine[event.state ? 'show' : 'hide']();
        this.render();
    }

    handleMouseEnter(e: MouseEvent | TouchEvent) {
        render('show popover', () => {
            this.popover.style.opacity = '1';
            this.chartCursor.style.opacity = '1';
        });
    }

    handleMouseLeave() {
        render('hide popover', () => {
            this.popover.style.opacity = '0';
            this.chartCursor.style.opacity = '0';
            this.lines.forEach(line => {
                line.hidePoint()
            });
        });
    }

    handleMouseMove(e: MouseEvent) {
        render('move popover', () => {
            const { exact: { startWith, endAt, length } } = this.brush.getWindow();
            const int = interpolate(startWith, endAt);
            const point = Math.round(int((e.clientX - this.viewportRect.left) / (this.width - CHART_POINTS_PADDING_RIGHT)));
            if (!this.xAxis.data[point]) {
                return;
            }
            const dateString = this.xAxis.getDate(point);
            const values = this.lines.map(line => {
                line.showPoint(point);
                return {
                    name: line.name,
                    value: line.data[point],
                    color: line.color
                }
            });
            this.popoverDate.innerHTML = dateString;
            let html = '';
            values.forEach(value => {
                html += `
                    <div class="tgc-popover__value" style="color: ${value.color}">
                        <div class="tgc-popover__number">${humanNumber(value.value)}</div>
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