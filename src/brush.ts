import Chart from './chart';
import Line from './line';
import Monitor from './monitor';
import { animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import EventEmitter, { Event } from './event-emitter';

export interface BrushChangeEvent extends Event {
    window: BrushWindow
};

export type BrushWindow = [AnimationCallback, number];

export type BrushOptions = {
    chart: Chart;
    lines: Line[];
    dataLength: number;
    monitor: Monitor;
};

type BrushWindowDnDSession = {
    clientX: number,
    inWindow: number,
    rect: ClientRect
};

type BrushHandleDnDSession = {
    clientX: number,
    direction: -1 | 1,
    rect: ClientRect
};

export default class Brush extends EventEmitter {

    chart: Chart;

    container: HTMLDivElement;
    brushWindow: HTMLDivElement;
    brushRightHandle: HTMLDivElement;

    brushWindowDnDSession?: BrushWindowDnDSession;

    brushHandleDnDSession?: BrushHandleDnDSession;

    lines: Line[];

    window: BrushWindow;
    
    dataLength: number;

    position: number;

    width: number;
    windowWidth: number;

    m: Monitor;

    interpolatePointsToWindowWidth: InterpolationFunction;
    interpolateWindowWidthToPoints: InterpolationFunction;

    constructor(private options: BrushOptions) {
        super();

        this.m = options.monitor;

        this.chart = options.chart;

        this.lines = options.lines;

        this.window = [() => 10, 30];

        this.dataLength = options.dataLength;

        this.position = 0;

        this.width = 0;
        this.windowWidth = 0;

        this.m.set('brush', {
            // window: this.window,
            dataLength: this.dataLength,
            position: this.position,
            width: this.width,
            windowWidth: this.windowWidth,
        });

        this.interpolatePointsToWindowWidth = () => 0;
        this.interpolateWindowWidthToPoints = interpolate(0, this.dataLength - 1);

        this.container = document.createElement("div");
        this.container.classList.add("tgc-brush");

        this.container.innerHTML = `
            <div class="tgc-brush__lines"></div>
            <div class="tgc-brush__window">
                <div class="tgc-brush__handle tgc-brush__handle-left"></div>
                <div class="tgc-brush__handle tgc-brush__handle-right"></div>
            </div>
        `;
        
        const brushLinesContainer = this.container.querySelector('.tgc-brush__lines');
        const brushWindow = this.container.querySelector('.tgc-brush__window');
        const brushRightHandle = this.container.querySelector('.tgc-brush__handle-right');

        if (brushLinesContainer === null || brushWindow === null || brushRightHandle === null) {
            throw new Error(`Something went wrong`);
        }

        this.brushWindow = brushWindow as HTMLDivElement;
        this.brushRightHandle = brushRightHandle as HTMLDivElement;

        brushLinesContainer.append(...this.lines.map(line => line.getContainer()));

        window.addEventListener("mousedown", this.handleMouseDown.bind(this));
        window.addEventListener("mousemove", this.handleMouseMove.bind(this));
        window.addEventListener("mouseup", this.handleMouseUp.bind(this));
    }

    handleMouseDown(event: MouseEvent) {
        // TODO disable user select and drag n drop
        const isClickOnBrushWindow = event.target === this.brushWindow;
        const isClickOnRightHandle = event.target === this.brushRightHandle;
        if (!isClickOnBrushWindow && !isClickOnRightHandle) {
            return;
        }
        const rect = this.container.getBoundingClientRect();
        if (isClickOnBrushWindow) {
            console.log('isClickOnBrushWindow');
            const brush = this.brushWindow.getBoundingClientRect();
            this.brushWindowDnDSession = {
                clientX: event.clientX,
                inWindow: event.clientX - brush.left,
                rect
            };
            return;
        }
        if (isClickOnRightHandle) {
            this.brushHandleDnDSession = {
                clientX: event.clientX,
                direction: -1,
                rect
            };
        }
    }

    handleMouseMove(event: MouseEvent) {
        if (this.brushWindowDnDSession) {
            const { clientX, rect, inWindow } = this.brushWindowDnDSession;
            const delta = event.clientX - clientX;
            this.brushWindowDnDSession.clientX = event.clientX;
            this.position = Math.max(event.clientX - rect.left - inWindow + delta, 0);
            // this.window[0] = Math.max(this.interpolateWindowWidthToPoints(this.position / this.width), 0);
            const startWithPrev = this.window[0]();
            const startWithNext = Math.max(this.interpolateWindowWidthToPoints(this.position / this.width), 0);
            this.window[0] = animation({
                from: startWithPrev, 
                to: startWithNext, 
                seconds: .12,
                isLinear: true
            });
            this.emit('change', {
                window: this.window
            });
            this.m.set('brush', {
                position: this.position,
                // window: this.window,
            });
            this.brushWindow.style.transform = `translateX(${this.position}px)`;
        }
        if (this.brushHandleDnDSession) {
            const { clientX, direction, rect } = this.brushHandleDnDSession;
            const delta = event.clientX - clientX;
            this.brushHandleDnDSession.clientX = event.clientX;
            this.updateWindowWidth(this.windowWidth - delta * direction);
            this.emit('change', {
                window: this.window
            });
        }
        // console.log(event);
    }

    handleMouseUp() {
        if (this.brushWindowDnDSession) {
            delete this.brushWindowDnDSession;
        }
        if (this.brushHandleDnDSession) {
            delete this.brushHandleDnDSession;
        }
    }

    getContainer() {
        return this.container;
    }

    getWindow() {
        const [startWith, points] = this.window;
        return [startWith(), points];
    }

    updateWindowWidth(width: number) {
        this.brushWindow.style.width = `${width}px`;
        // 
        this.windowWidth = width;
        this.window[1] = this.interpolateWindowWidthToPoints(width / this.width);
        this.m.set('brush', {
            // window: this.window,
            windowWidth: this.windowWidth
        });
    }

    appendTo(el: Element) {
        // TODO resize
        el.append(this.container);
        const { left, right } = this.container.getBoundingClientRect();
        this.width = right - left;
        const [startWith, size] = this.window;
        this.interpolatePointsToWindowWidth = interpolate(0, this.width);
        this.windowWidth = this.interpolatePointsToWindowWidth((size) / (this.dataLength - 1));
        this.brushWindow.style.width = `${this.windowWidth}px`;
        this.position = this.interpolatePointsToWindowWidth(startWith() / (this.dataLength - 1));
        this.brushWindow.style.transform = `translateX(${this.position}px)`;
        this.m.set('brush', {
            width: this.width,
            windowWidth: this.windowWidth
        });
    }
}