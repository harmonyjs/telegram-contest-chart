import Line from './line';
import { interpolate, InterpolationFunction } from './utils';
import Brush, { BrushChangeEvent } from './brush';
import Monitor from './monitor';
import render from './render';

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
            <div class="tgc-lines"></div>
        `;

        const monitor = new Monitor({});
        monitor.appendTo(this.container);

        const linesContainer = this.container.querySelector('.tgc-lines');

        if (linesContainer === null) {
            throw new Error(`Something went wrong`);
        }

        let dataLength = 0;

        for (let i = 0; i < this.data.columns.length; i++) {
            const column = this.data.columns[i];
            const [name, ...dataArray] = column;
            if (name === 'x') continue;
            const data = new Int32Array(dataArray as number[]);
            dataLength = Math.max(data.length, dataLength);
            this.lines.push(new Line({
                chart: this,
                name: name as string,
                data,
                width: this.width,
                height: this.height,
                className: "tgc-lines__canvas",
                isBrush: false,
                monitor
            }));
            this.brushLines.push(new Line({
                chart: this,
                name: name as string,
                data,
                width: this.width,
                height: 40,  // TODO
                className: "tgc-brush__line",
                isBrush: true,
                monitor
            }));
        }

        linesContainer.append(...this.lines.map(line => line.getContainer()));

        this.brush = new Brush({
            chart: this,
            lines: this.brushLines,
            dataLength,
            monitor
        });

        this.brush.appendTo(this.container);

        this.brush.on('change', this.handleWindowChange.bind(this));

        this.lines.forEach(line => line.render());
        this.brushLines.forEach(line => line.render());
    }

    handleWindowChange(event: BrushChangeEvent) {
        this.lines.forEach(line => 
            render(() => line.render())
        );
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
        return Math.max(...this.lines.map(line => line.getCurrentMax()));
    }

    getCurrentMin() {
        return Math.min(...this.lines.map(line => line.getCurrentMin()));
    }

}