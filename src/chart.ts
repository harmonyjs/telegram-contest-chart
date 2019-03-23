import Line from './line';
import { interpolate, InterpolationFunction, animation, AnimationCallback } from './utils';
import Brush, { BrushChangeEvent } from './brush';
import YAxis from './y-axis';
import Monitor from './monitor';
import render from './render';
import { LINE_TYPE, Y_AXIS_ANIMATION_DURATION } from './constants';

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
    container: Element | null;
    data: ChartDataObject;
    title?: string;
    width?: number;
    height?: number;
};

export default class Chart {

    container: Element;

    data: ChartDataObject;

    context: CanvasRenderingContext2D[];

    width: number;
    height: number;

    interpolateX: InterpolationFunction;
    
    lines: Line[];
    brushLines: Line[];

    brush: Brush;

    yAxis: YAxis;

    _maxValueAnimation?: AnimationCallback;

    private _prevMax?: number;

    get title() {
        const { title } = this.options;
        return title || `Unnamed Chart`;
    }

    constructor(private options: ChartOptions) {
        if (options.container === null) {
            throw new Error(`container options is mandatory`);
        }
        this.container = options.container;
        this.data = options.data;
        this.context = [];
        this.width = options.width || this.getContainerWidth() || 0;
        this.height = options.height || ((this.width * 0.5) | 0) || 0;
        this.lines = [];
        this.brushLines = [];

        this.interpolateX = interpolate(0, this.width);

    //     this.initialize();
    // }

    // initialize() {
        const { title } = this.options;

        this.container.classList.add('tgc-chart');
        this.container.innerHTML = `
            <div class="tgc-chart__title">${ this.title }</div>
            <div class="tgc-viewport">
                <div class="tgc-lines"></div>
            </div>
        `;

        const monitor = new Monitor({});
        // monitor.appendTo(this.container);

        const linesContainer = this.container.querySelector('.tgc-lines');
        const viewportContainer = this.container.querySelector('.tgc-viewport');

        if (linesContainer === null || viewportContainer === null) {
            throw new Error(`Something went wrong`);
        }

        let dataLength = 0;

        for (let i = 0; i < this.data.columns.length; i++) {
            const column = this.data.columns[i];
            const [alias, ...dataArray] = column;
            const type = this.data.types[alias];
            if (type !== LINE_TYPE) continue;
            const name = this.data.names[alias];
            const color = this.data.colors[alias];
            const data = new Int32Array(dataArray as number[]);
            dataLength = Math.max(data.length, dataLength);

            const line = new Line({
                chart: this,
                alias: alias as string,
                name,
                color,
                data,
                width: this.width,
                height: this.height,
                className: "tgc-lines__canvas",
                isBrush: false,
                monitor
            });
            line.on('animation-end', this.handleLineAnimationEnd.bind(this));
            this.lines.push(line);

            const brushLine = new Line({
                chart: this,
                alias: alias as string,
                name,
                color,
                data,
                width: this.width,
                height: 50,  // TODO
                className: "tgc-brush__line",
                isBrush: true,
                monitor
            });
            brushLine.on('animation-end', this.handleLineAnimationEnd.bind(this));
            this.brushLines.push(brushLine);
        }

        linesContainer.append(...this.lines.map(line => line.getContainer()));

        this.brush = new Brush({
            chart: this,
            lines: this.brushLines,
            dataLength,
            monitor
        });

        this.yAxis = new YAxis({
            chart: this
        });

        this.brush.appendTo(this.container);
        this.yAxis.appendTo(viewportContainer);

        this.brush.on('change', this.handleWindowChange.bind(this));

        (window as any).render = this.handleWindowChange.bind(this);

        this.lines.forEach(line => line.render());
        this.brushLines.forEach(line => line.render());
    }

    render(recursive: boolean = false) {
        if (recursive && !this._maxValueAnimation && !this.brush.hasAnimation()) {
            return;
        }
        this.lines.forEach(line => line.render());
        render('chart render', () => this.render(true));
    }

    handleWindowChange() {
        console.log('handleWindowChange');
        render('chart render', () => this.render());
    }

    handleLineAnimationEnd() {
        console.log('handleLineAnimationEnd');
        render('chart render', () => this.render());
    }

    getContainerWidth(): number {
        const { width } = this.container.getBoundingClientRect();
        return width;
    }

    getMax() {
        return Math.max(...this.lines.map(line => line.getMax()));
    }

    getMin() {
        return Math.min(...this.lines.map(line => line.getMin()));
    }

    getCurrentMax() {
        const max = this.getCurrentMaxExact();
        // console.log(toInt(startWith), toInt(startWith+numOfOperatingPoints));
        // console.log(max);
        if (this._prevMax && this._prevMax !== max) {
            const from = this._maxValueAnimation ? this._maxValueAnimation() : this._prevMax;
            this._maxValueAnimation = animation({
                from, 
                to: max, 
                seconds: Y_AXIS_ANIMATION_DURATION,
                callback: this.handleLineAnimationEnd.bind(this)
            });
            this._prevMax = max;
            return this._maxValueAnimation();
        }
        if (this._maxValueAnimation) {
            const value = this._maxValueAnimation();
            if (value === this._prevMax) {
                delete this._maxValueAnimation;
            }
            return value;
        }
        this._prevMax = max;
        return max;
    }

    getCurrentMaxExact() {
        return Math.max(...this.lines.map(line => line.getCurrentMax()));
    }

    getCurrentMin() {
        return Math.min(...this.lines.map(line => line.getCurrentMin()));
    }

}