import Chart from './chart';
import Line from './line';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction, handleEvent } from './utils';
import EventEmitter, { Event } from './event-emitter';
import { X_AXIS_ANIMATION_DURATION, BRUSH_WINDOW_DIRECTION, MINIMAL_POINTS_IN_VIEW, EXTRA_POINTS_ON_THE_LEFT, EXTRA_POINTS_ON_THE_RIGHT } from './constants';
import render from './render';

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
    brushLinesContainer: HTMLDivElement;

    brushWindowDnDSession?: brushWindowDnDSession;

    lines: Line[] = [];

    window: BrushWindow = [
        (() => 0) as AnimationCallback, 
        (() => 0) as AnimationCallback, 
        0
    ];

    position: number;

    width: number;
    windowWidth: number;
    minimalWindowWidth: number;

    interpolatePointsToWindowWidth: InterpolationFunction;
    interpolateWindowWidthToPoints: InterpolationFunction;

    constructor(private options: BrushOptions) {
        super();

        this.chart = options.chart;

        // this.dataLength = options.dataLength;

        this.position = 0;

        this.width = 0;
        this.windowWidth = 0;
        this.minimalWindowWidth = 0

        this.interpolatePointsToWindowWidth = () => 0;
        this.interpolateWindowWidthToPoints = () => 0;

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

        this.brushLinesContainer = brushLinesContainer as HTMLDivElement;

        this.brushWindow = brushWindow as HTMLDivElement;
        this.brushLeftHandle = brushLeftHandle as HTMLDivElement;
        this.brushRightHandle = brushRightHandle as HTMLDivElement;

        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        document.addEventListener("mousedown", this.handleMouseDown);
        document.addEventListener("mousemove", this.handleMouseMove);
        document.addEventListener("mouseup", this.handleMouseUp);

        document.addEventListener("touchstart", this.handleMouseDown, true);
        document.addEventListener("touchmove", this.handleMouseMove, true);
        document.addEventListener("touchend", this.handleMouseUp, true);
    }

    getDataLength() { // TODO cache + dedup max =
        return Math.max(...this.lines.map(line => line.data.length));
    }

    getMaxDataIndex() {
        return this.getDataLength() - 1;
    }

    addLines(lines: Line[]) {

        this.lines.push(...lines);

        const maxIndex = this.getMaxDataIndex();
        const quarter = Math.round(maxIndex * 0.75);

        this.brushLinesContainer.append(...lines.map(line => line.getContainer()));
        this.interpolateWindowWidthToPoints = interpolate(0, maxIndex);
        
        this.window = [
            animation({ from: quarter, to: quarter, seconds: 0 }), 
            animation({ from: maxIndex, to: maxIndex, seconds: 0 }),
            maxIndex - quarter
        ];

        //
        const { startWith, exact: { length } } = this.getWindow();
        this.interpolatePointsToWindowWidth = interpolate(0, this.width);
        this.minimalWindowWidth = MINIMAL_POINTS_IN_VIEW * this.interpolatePointsToWindowWidth(1/maxIndex);
        this.windowWidth = this.interpolatePointsToWindowWidth(length / maxIndex);
        this.brushWindow.style.width = `${this.windowWidth}px`;
        this.position = this.interpolatePointsToWindowWidth(startWith / maxIndex);
        this.brushWindow.style.transform = `translateX(${this.position}px)`;

        this.emit('change', {
            window: this.window,
            position: this.position,
            action: BRUSH_WINDOW_DIRECTION.LEFT
        });
    }

    handleMouseDown(event: MouseEvent | TouchEvent) {
        const { target, clientX } = handleEvent(event);
        const isClickOnBrushWindow = target === this.brushWindow;
        const isClickOnLeftHandle = target === this.brushLeftHandle;
        const isClickOnRightHandle = target === this.brushRightHandle;
        if (!isClickOnBrushWindow && !isClickOnRightHandle && !isClickOnLeftHandle) {
            return;
        }
        const rect = this.container.getBoundingClientRect();
        const brush = this.brushWindow.getBoundingClientRect();
        this.brushWindowDnDSession = {
            clientX: clientX - rect.left,
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

        render('brush move', () => {
            if (!this.brushWindowDnDSession) {
                return;
            }
            const { clientX: eventClientX } = handleEvent(event);

            const { exact: { endAt, length } } = this.getWindow();

            const { clientX, action, rect, brush } = this.brushWindowDnDSession;

            const px = eventClientX - rect.left;
            const points = this.interpolateWindowWidthToPoints(px / this.width);
            const delta = eventClientX - rect.left - clientX;

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
                position: this.position,
                action
            });
        });
    }

    handleMouseUp() {
        delete this.brushWindowDnDSession;
    }

    updateStartWith(options: UpdateBrushWindowValueOptions) {
        const { points, startTime } = options;
        const { startWith: startWithPrev, exact: { endAt, length } } = this.getWindow();
        const startWithNext = minmax(
            0,
            points,
            this.getMaxDataIndex()
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
        const endAtNext = minmax(
            MINIMAL_POINTS_IN_VIEW,
            points,
            this.getMaxDataIndex()
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
        this.position = this.interpolatePointsToWindowWidth(startWith / this.getMaxDataIndex());
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
        this.windowWidth = Math.round(minmax(
            this.minimalWindowWidth,
            this.interpolatePointsToWindowWidth((endAt - startWith) / this.getMaxDataIndex()),
            this.width - this.position
        ));
        this.brushWindow.style.width = `${this.windowWidth}px`;
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
        const end = this.getMaxDataIndex();
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
    }
}