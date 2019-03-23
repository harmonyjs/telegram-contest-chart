import Chart from './chart';
import Monitor from './monitor';
import { toInt, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import render from './render';
import { MAIN_LINE_WIDTH, BRUSH_LINE_WIDTH, Y_AXIS_ANIMATION_DURATION, SHOULD_COUNT_EXTRA_POINT_IN_MAX } from './constants';
import EventEmitter from './event-emitter';

export type LineOptions = {
    chart: Chart;
    alias: string;
    name: string;
    color: string;
    data: Int32Array;
    width: number;
    height: number;
    isBrush: boolean;
    className?: string;
    monitor: Monitor;
};

let prevM = 0;

export default class Line extends EventEmitter {

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

    interpolateY: InterpolationFunction;

    _maxValueAnimation?: AnimationCallback;

    constructor(private options: LineOptions) {
        super();

        this.chart = options.chart;

        this.name = options.name;

        this.data = options.data;

        this.width = options.width;
        this.height = options.height;

        this.m = options.monitor;
        
        this.interpolateY = interpolate(0, this.height);

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
        const { isBrush, color } = this.options;
        const ctx = this.context;
        const data = this.data;

        if (!this.empty) {
            this.clear();
        }

        const {
            startWith, 
            endAt,
            length,
            startPointIndex,
            endPointIndex,
            leftPad,
            rightPad
        } = (
            isBrush ? this.chart.brush.getWholeWindow()
                    : this.chart.brush.getWindow()
        );

        const max = isBrush ? this.chart.getMax() : this.chart.getCurrentMax();

        const startWithFloor = Math.floor(startWith);
        const pointsCeil = Math.ceil(length);

        this.m.set('line' + isBrush, {
            startWith: startWith, length,
            leftPad,
            rightPad,
            startWithFloor: startWithFloor,
            pointsCeil: pointsCeil
        });
        
        ctx.strokeStyle = color;
        ctx.lineWidth = isBrush ? BRUSH_LINE_WIDTH : MAIN_LINE_WIDTH;
	    ctx.lineCap = 'round';

        ctx.beginPath();

        for (
            let index = startPointIndex, orderNum = 0; 
            index <= endPointIndex; 
            index++, orderNum++
        ) {
            const x = this.chart.interpolateX((orderNum - leftPad) / length);
            const y = this.interpolateY(data[index] / max);
            if (orderNum === 0) {
                ctx.moveTo(x, y);
            }
            ctx.lineTo(x, y);
            // ctx.arc(x, y, 4, 0, 2 * Math.PI);
        }
        
        ctx.stroke();
        
        this.empty = false;
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

    getCurrentData() {
        const { startPointIndex, endPointIndex } = this.chart.brush.getWindow();
        return this.data.slice(startPointIndex, endPointIndex + 1);
    }

    getCurrentMax() {
        const data = this.getCurrentData();
        // console.log(data);
        return Math.max(...data);
    }

    getCurrentMin() { // TODO
        const { isBrush } = this.options;
        // if (typeof this._min === 'number') {
        //     return this._min;
        // }
        const { startWith, exact: { length } } = this.chart.brush.getWindow();
        const min = Math.min(0, ...this.data.slice(toInt(startWith), toInt(length)));
        // this._min = min;
        return min;
    }

}