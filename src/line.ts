import Chart from './chart';
import Monitor from './monitor';
import { interpolate, InterpolationFunction } from './utils';

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

    private _max?: number;
    private _min?: number;

    context: CanvasRenderingContext2D;

    width: number;
    height: number;

    m: Monitor;

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

        this.initialize();
    }

    initialize() {

    }

    render() {
        const { isBrush } = this.options;
        const ctx = this.context;
        const data = this.data;

        ctx.imageSmoothingEnabled = false;
        
        ctx.lineWidth = 1;
	    ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0,0);

        const [from, numOfPoints] = (
            isBrush ? [0, this.data.length]
                    : this.chart.brush.window
        );

        const interpolateY = interpolate(0, this.height);

        const max = this.chart.getMax();

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


        console.log('======================================');

        const pPlus2 = Math.ceil(numOfPoints) + 2;

        const ax = [];
        for (let i = 0; i < pPlus2; i++) {
            console.log({ i });
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

        console.log(ax);
        
        ctx.stroke();
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

}