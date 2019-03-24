import Chart from './chart';
import Monitor from './monitor';
import { toInt, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import { MAIN_LINE_WIDTH, BRUSH_LINE_WIDTH, Y_AXIS_ANIMATION_DURATION, SHOULD_COUNT_EXTRA_POINT_IN_MAX } from './constants';

export type LineOptions = {
    chart: Chart;
    alias: string;
    name: string;
    color: string;
    data: Array<number>;
    width: number;
    height: number;
    isBrush: boolean;
    className?: string;
    monitor: Monitor;
};

let prevM = 0;

export default class Line {

    chart: Chart;

    container: HTMLDivElement;
    canvas: HTMLCanvasElement;

    name: string;
    alias: string;
    data: Array<number>;//Int32Array;

    private _prevMax?: number;

    private _max?: number;
    private _min?: number;

    context: CanvasRenderingContext2D;

    width: number;
    height: number;

    m: Monitor;
    
    empty: boolean;
    visible: boolean;

    interpolateY: InterpolationFunction;

    _maxValueAnimation?: AnimationCallback;

    selectedPoint?: number;

    constructor(private options: LineOptions) {
        this.chart = options.chart;

        this.name = options.name;
        this.alias = options.alias;

        this.data = options.data;

        this.width = options.width;
        this.height = options.height;

        this.m = options.monitor;
        
        this.interpolateY = interpolate(0, this.height);

        this.container = document.createElement("div");

        this.canvas = document.createElement("canvas");
        this.canvas.setAttribute('width', String(this.width));
        this.canvas.setAttribute('height', String(this.height));
        

        this.container.append(this.canvas);

        if (options.className) {
            this.container.classList.add(options.className);
        }

        this.context = this.getContext();

        // change sysem of coordinates
        this.context.translate(0, this.height);
        this.context.scale(1, -1);

        this.empty = true;
        this.visible = true;
    }

    render() {
        const { isBrush, color } = this.options;
        const ctx = this.context;
        const data = this.data;

        const max = isBrush ? this.chart.getMax() : this.chart.getCurrentMax();

        if (isBrush && this._prevMax === max) {
            return;
        }

        this._prevMax = max;

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

        const startWithFloor = Math.floor(startWith);
        const pointsCeil = Math.ceil(length);

        // this.m.set('line' + isBrush, {
        //     startWith: startWith, length,
        //     leftPad,
        //     rightPad,
        //     startWithFloor: startWithFloor,
        //     pointsCeil: pointsCeil
        // });

        const lineWidth = isBrush ? BRUSH_LINE_WIDTH : MAIN_LINE_WIDTH;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
	    ctx.lineCap = 'round';

        ctx.beginPath();

        let selectedPointCoords;

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
            if (this.selectedPoint === index) {
                selectedPointCoords = { x, y };
                
            }
        }
        
        ctx.stroke();

        if (selectedPointCoords) {
            const { x, y } = selectedPointCoords;
            ctx.beginPath();
            ctx.fillStyle = "#ffffff";
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.moveTo(x, y);
            ctx.fill();
            ctx.beginPath();
            ctx.lineWidth = lineWidth;
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.moveTo(x, y);
            ctx.stroke();
        }
        
        this.empty = false;
    }

    showPoint(point: number) {
        this.selectedPoint = point;
        this.render();
    }

    show() {
        this.visible = true;
        this.container.classList.remove('tgc-line_hidden'); // TODO through render?
    }

    hide() {
        this.visible = false;
        this.container.classList.add('tgc-line_hidden'); // TODO through render?
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
        if (!this.visible) {
            return 0;
        }
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
        if (!this.visible) {
            return 0;
        }
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