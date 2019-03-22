import Chart from './chart';
import Monitor from './monitor';
import { toInt, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import render from './render';

export type LineOptions = {
    chart: Chart;
    name: string;
    data: Int32Array;
    width: number;
    height: number;
    isBrush: boolean;
    className?: string;
    monitor: Monitor;
};

export default class Line {

    chart: Chart;

    container: HTMLDivElement;
    canvas: HTMLCanvasElement;

    name: string;
    data: Int32Array;

    private _prevMax?: number;

    private _max?: number;
    private _min?: number;

    context: CanvasRenderingContext2D;

    width: number;
    height: number;

    m: Monitor;
    
    empty: boolean;

    _maxValueAnimation?: AnimationCallback;

    constructor(private options: LineOptions) {

        this.chart = options.chart;

        this.name = options.name;

        this.data = options.data;

        this.width = options.width;
        this.height = options.height;

        this.m = options.monitor;

        this.container = document.createElement("div");

        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute('width', this.width.toString());
        this.canvas.setAttribute('height', this.height.toString());

        this.container.append(this.canvas);

        if (options.className) {
            this.container.classList.add(options.className);
        }

        this.context = this.getContext();

        // change sysem of coordinates
        this.context.translate(0, this.height);
        this.context.scale(1, -1);

        this.empty = true;
    }

    render() {
        const { isBrush } = this.options;
        const ctx = this.context;
        const data = this.data;

        if (!this.empty) {
            this.clear();
        }

        ctx.imageSmoothingEnabled = false;
        
        ctx.lineWidth = 1;
	    ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0,0);

        const [from, numOfPoints] = (
            isBrush ? [0, this.data.length]
                    : this.chart.brush.getWindow()
        );

        const interpolateY = interpolate(0, this.height);

        const max = isBrush ? this.chart.getMax() : this.chart.getCurrentMax();

        const leftPad = from % 1;
        const rightPad = numOfPoints % 1;

        const startWith = Math.floor(from);
        const points = Math.ceil(numOfPoints);

        this.m.set('line' + isBrush, {
            from, numOfPoints,
            leftPad,
            rightPad,
            startWith,
            points
        });

        if (isBrush) {
            console.log('>', this.chart.interpolateX(1));
            for (let i = 0; i < points; i++) {
                const x = this.chart.interpolateX(i / (points - 1));
                const y = interpolateY(data[i] / max);
                if (!i) {
                    ctx.moveTo(x, y);
                }
                ctx.lineTo(x, y);
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                // console.log({ x, y })
            }
            ctx.stroke();
            return;
        }

        const pPlus2 = Math.ceil(numOfPoints) + 2;

        const ax = [];
        for (let i = 0; i < pPlus2; i++) {
            // console.log({ i });
            const pointNum = startWith + i;
            const x = this.chart.interpolateX((i - leftPad) / (numOfPoints));
            const y = interpolateY(data[pointNum] / max);
            if (!i) {
                ctx.moveTo(x, y);
            }
            ctx.lineTo(x, y);
            ax.push(x);
            // ctx.arc(x, y, 2, 0, 2 * Math.PI);
            // ctx.fillText(i+'('+pointNum+')', x, y - 16)
            // console.log({ x, y })
        }

        // console.log(ax);
        
        ctx.stroke();
        
        this.empty = false;

        // if (this._maxValueAnimation) {
            render(() => this.render());
            // render(() => setTimeout(() => this.render(), 0));
        // }
    }

    clear() {
        const ctx = this.context;

        // Store the current transformation matrix
        ctx.save();

        // Use the identity matrix while clearing the canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        // Restore the transform
        ctx.restore();

        this.empty = true;
    }

    getContext() {
        const ctx = this.canvas.getContext('2d');
        if (ctx === null) {
            throw new Error(`Context for line doesn't found`);
        }
        return ctx;
    }

    getContainer() {
        return this.container;
    }

    getMax() {
        if (typeof this._max === 'number') {
            return this._max;
        }
        const max = Math.max(...this.data);
        this._max = max;
        return max;
    }

    getMin() {
        if (typeof this._min === 'number') {
            return this._min;
        }
        const min = Math.min(0, ...this.data);
        this._min = min;
        return min;
    }

    getCurrentMax() {
        const [startWith, points] = this.chart.brush.getWindow();
        const data = this.data.slice(toInt(startWith), toInt(startWith+points));
        const max = Math.max(...data);
        if (this._prevMax && this._prevMax !== max) {
            this._maxValueAnimation = animation({
                from: this._prevMax, 
                to: max, 
                seconds: .33
            });
            this._prevMax = max;
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

    getCurrentMin() {
        const { isBrush } = this.options;
        // if (typeof this._min === 'number') {
        //     return this._min;
        // }
        const [startWith, points] = this.chart.brush.getWindow();
        const min = Math.min(0, ...this.data.slice(toInt(startWith), toInt(points)));
        // this._min = min;
        return min;
    }

}