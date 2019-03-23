import Chart from './chart';
import Line from './line';
import Monitor from './monitor';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction } from './utils';
import EventEmitter, { Event } from './event-emitter';
import { X_AXIS_ANIMATION_DURATION, BRUSH_WINDOW_DIRECTION, MINIMAL_POINTS_IN_VIEW, EXTRA_POINTS_ON_THE_LEFT, EXTRA_POINTS_ON_THE_RIGHT } from './constants';

export interface BrushChangeEvent extends Event {
    window: BrushWindow
};

export type BrushWindow = [AnimationCallback, AnimationCallback, number];

export type BrushWindowObject = {
    startWith: number,
    endAt: number,
    length: number,
    exact: {
        startWith: number,
        endAt: number,
        length: number
    },
    startPointIndex: number,
    endPointIndex: number,
    leftPad: number,
    rightPad: number
};

export type BrushOptions = {
    chart: Chart;
    lines: Line[];
    dataLength: number;
    monitor: Monitor;
};

type brushWindowDnDSession = {
    clientX: number,
    action: BRUSH_WINDOW_DIRECTION,
    rect: ClientRect,
    brush: ClientRect,
};

type UpdateBrushWindowValueOptions = {
    points: number, 
    startTime?: number,
};

export default class Brush extends EventEmitter {

    chart: Chart;

    container: HTMLDivElement;
    brushWindow: HTMLDivElement;
    brushLeftHandle: HTMLDivElement;
    brushRightHandle: HTMLDivElement;

    brushWindowDnDSession?: brushWindowDnDSession;

    lines: Line[];

    window: BrushWindow;
    
    dataLength: number;

    position: number;

    width: number;
    windowWidth: number;
    minimalWindowWidth: number;

    m: Monitor;

    interpolatePointsToWindowWidth: InterpolationFunction;
    interpolateWindowWidthToPoints: InterpolationFunction;

    constructor(private options: BrushOptions) {
        super();

        this.m = options.monitor;

        this.chart = options.chart;

        this.lines = options.lines;

        this.window = [
            // animation({ from: 1.9, to: 1.9, seconds: 0 }), 
            // 1.5
            animation({ from: 3.9, to: 3.9, seconds: 0 }), 
            animation({ from: 5.8, to: 5.8, seconds: 0 }),
            1.9
        ];

        this.dataLength = options.dataLength;

        this.position = 0;

        this.width = 0;
        this.windowWidth = 0;
        this.minimalWindowWidth = 0

        this.m.set('brush', {
            ...this.getWindow(),
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
        const brushLeftHandle = this.container.querySelector('.tgc-brush__handle-left');
        const brushRightHandle = this.container.querySelector('.tgc-brush__handle-right');

        if (brushLinesContainer === null || brushWindow === null || brushLeftHandle === null || brushRightHandle === null) {
            throw new Error(`Something went wrong`);
        }

        this.brushWindow = brushWindow as HTMLDivElement;
        this.brushLeftHandle = brushLeftHandle as HTMLDivElement;
        this.brushRightHandle = brushRightHandle as HTMLDivElement;

        brushLinesContainer.append(...this.lines.map(line => line.getContainer()));

        window.addEventListener("mousedown", this.handleMouseDown.bind(this));
        window.addEventListener("mousemove", this.handleMouseMove.bind(this));
        window.addEventListener("mouseup", this.handleMouseUp.bind(this));
    }

    handleMouseDown(event: MouseEvent) {
        // TODO disable user select and drag n drop
        const isClickOnBrushWindow = event.target === this.brushWindow;
        const isClickOnLeftHandle = event.target === this.brushLeftHandle;
        const isClickOnRightHandle = event.target === this.brushRightHandle;
        if (!isClickOnBrushWindow && !isClickOnRightHandle && !isClickOnLeftHandle) {
            return;
        }
        const rect = this.container.getBoundingClientRect();
        const brush = this.brushWindow.getBoundingClientRect();
        this.brushWindowDnDSession = {
            clientX: event.clientX - rect.left,
            action: (
                isClickOnRightHandle ? BRUSH_WINDOW_DIRECTION.RIGHT :
                 isClickOnLeftHandle ? BRUSH_WINDOW_DIRECTION.LEFT
                                     : BRUSH_WINDOW_DIRECTION.MOVE
            ),
            rect,
            brush
        };
    }

    handleMouseMove(event: MouseEvent) {
        if (!this.brushWindowDnDSession) {
            return;
        }

        const { exact: { endAt, length } } = this.getWindow();

        // console.log('move', { length });

        const { clientX, action, rect, brush } = this.brushWindowDnDSession;

        const px = event.clientX - rect.left;
        const points = this.interpolateWindowWidthToPoints(px / this.width);
        const delta = event.clientX - rect.left - clientX;

        if (
            action === BRUSH_WINDOW_DIRECTION.LEFT
        ) {
            this.updateStartWith({ 
                points: Math.min(
                    points,
                    endAt - MINIMAL_POINTS_IN_VIEW
                ) 
            });
            this.updatePosition();
            this.updateWindowWidth();
        }
        if (action === BRUSH_WINDOW_DIRECTION.MOVE) {
            const startWith = this.interpolateWindowWidthToPoints((brush.left - rect.left + delta) / this.width);
            const endAt = this.interpolateWindowWidthToPoints((brush.right - rect.left + delta) / this.width);
            const startTime = Date.now();
            if (delta < 0) {
                const startWithNext = this.updateStartWith({
                    points: startWith,
                    startTime
                });
                this.updateEndAt({
                    points: startWithNext + length,
                    startTime
                });
            } else {
                const endAtNext = this.updateEndAt({
                    points: endAt,
                    startTime
                });
                this.updateStartWith({
                    points: endAtNext - length,
                    startTime
                });
            }
            this.updatePosition();
        }
        if (action === BRUSH_WINDOW_DIRECTION.RIGHT) {
            this.updateEndAt({ points });
            this.updateWindowWidth();
        }
        
        this.emit('change', {
            window: this.window,
            position: this.position
        });
        
        this.m.set('brush', {
            ...this.getWindow(),
            windowWidth: this.windowWidth
        });
    }

    updateStartWith(options: UpdateBrushWindowValueOptions) {
        const { points, startTime } = options;
        const { startWith: startWithPrev, exact: { endAt, length } } = this.getWindow();
        const max = this.dataLength - 1;
        // console.log('updateStartWith', { length });
        const startWithNext = minmax(
            0,
            points,
            max// - length
        );
        this.window[0] = animation({
            from: startWithPrev, 
            to: startWithNext, 
            seconds: X_AXIS_ANIMATION_DURATION,
            isLinear: true,
            startTime
        });
        this.window[2] = endAt - startWithNext;
        return startWithNext;
    }

    updateEndAt(options: UpdateBrushWindowValueOptions) {
        const { points, startTime } = options;
        const { endAt: endAtPrev, exact: { startWith, length } } = this.getWindow();
        // console.log('updateEndAt', { length });
        const max = this.dataLength - 1;
        const endAtNext = minmax(
            MINIMAL_POINTS_IN_VIEW,
            points,
            max
        );
        this.window[1] = animation({
            from: endAtPrev,
            to: endAtNext,
            seconds: X_AXIS_ANIMATION_DURATION,
            isLinear: true,
            startTime
        });
        this.window[2] = endAtNext - startWith;
        return endAtNext;
    }

    /**
     * Depends on:
     *  - exact.startWith
     *  - windowWidth
     *  - width
     */
    updatePosition() {
        const { exact: { startWith } } = this.getWindow();
        const max = this.dataLength - 1;
        this.position = this.interpolatePointsToWindowWidth(startWith / max);
        this.brushWindow.style.transform = `translateX(${this.position}px)`;
    }

    /**
     * Depends on:
     *  - exact.length
     *  - position
     *  - width
     */
    updateWindowWidth() {
        const { exact: { startWith, endAt } } = this.getWindow();
        const max = this.dataLength - 1;
        this.windowWidth = Math.round(minmax(
            this.minimalWindowWidth,
            this.interpolatePointsToWindowWidth((endAt - startWith) / max),
            this.width - this.position
        ));
        this.brushWindow.style.width = `${this.windowWidth}px`;
    }

    handleMouseUp() {
        delete this.brushWindowDnDSession;
    }

    getContainer() {
        return this.container;
    }

    getWindow(): BrushWindowObject {
        const [getStartWith, getEndAt, length] = this.window;
        const startWith = getStartWith();
        const endAt = getEndAt();
        return {
            startWith,
            endAt,
            length: endAt - startWith,
            exact: {
                startWith: getStartWith.to,
                endAt: getEndAt.to,
                length
            },
            leftPad: startWith % 1,
            rightPad: endAt % 1,
            startPointIndex: Math.floor(startWith),
            endPointIndex: Math.ceil(endAt)
        };
    }

    getWholeWindow(): BrushWindowObject {
        const end = this.dataLength - 1;
        return {
            startWith: 0,
            endAt: end,
            length: end,
            exact: {
                startWith: 0,
                endAt: end,
                length: end
            },
            leftPad: 0,
            rightPad: 0,
            startPointIndex: 0,
            endPointIndex: end
        };
    }

    hasAnimation(): boolean {
        const [getStartWith, getEndAt] = this.window;
        return !getStartWith.finished || !getEndAt.finished;
    }

    appendTo(el: Element) {
        // TODO resize
        el.append(this.container);
        const { left, right } = this.container.getBoundingClientRect();
        this.width = right - left;
        const { startWith, exact: { length } } = this.getWindow();
        const max = this.dataLength - 1;
        this.interpolatePointsToWindowWidth = interpolate(0, this.width);
        this.minimalWindowWidth = MINIMAL_POINTS_IN_VIEW * this.interpolatePointsToWindowWidth(1/max);
        this.windowWidth = this.interpolatePointsToWindowWidth(length / max);
        this.brushWindow.style.width = `${this.windowWidth}px`;
        this.position = this.interpolatePointsToWindowWidth(startWith / max);
        this.brushWindow.style.transform = `translateX(${this.position}px)`;
        this.m.set('brush', {
            width: this.width,
            windowWidth: this.windowWidth
        });
    }
}