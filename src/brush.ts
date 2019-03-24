import Chart from './chart';
import Line from './line';
import { minmax, animation, AnimationCallback, interpolate, InterpolationFunction, handleEvent, transform, translateX, className, find } from './utils';
import EventEmitter, { Event } from './event-emitter';
import { X_AXIS_ANIMATION_DURATION, BRUSH_WINDOW_DIRECTION, MINIMAL_POINTS_IN_VIEW, INITIAL_BRUSH_SIZE } from './constants';
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

const zero = () => 0;

export default class Brush extends EventEmitter {

    chart: Chart;

    container: HTMLElement;
    brushWindow: HTMLElement;
    brushLeftHandle: HTMLElement;
    brushRightHandle: HTMLElement;
    brushLinesContainer: HTMLElement;

    brushWindowDnDSession?: brushWindowDnDSession;

    lines: Line[] = [];

    window: BrushWindow = [
        (zero) as AnimationCallback, 
        (zero) as AnimationCallback, 
        0
    ];

    position: number = 0;

    width: number = 0;
    windowWidth: number = 0;
    minimalWindowWidth: number = 0;

    interpolatePointsToWindowWidth: InterpolationFunction;
    interpolateWindowWidthToPoints: InterpolationFunction;

    constructor(private options: BrushOptions) {
        super();

        const self = this;

        self.chart = options.chart;

        self.interpolatePointsToWindowWidth = zero;
        self.interpolateWindowWidthToPoints = zero;

        const container = self.container = document.createElement("div");
        container.classList.add(className('brush'));

        container.innerHTML = `
            <div class="tgc-brush__lines"></div>
            <div class="tgc-brush__window">
                <div class="tgc-brush__handle tgc-brush__handle-left"></div>
                <div class="tgc-brush__handle tgc-brush__handle-right"></div>
            </div>
        `;
        
        self.brushLinesContainer = find(container, className('brush', 'lines'));
        self.brushWindow = find(container, className('brush', 'window'));
        self.brushLeftHandle = find(container, className('brush', 'handle', 'left'));
        self.brushRightHandle = find(container, className('brush', 'handle', 'right'));

        self.handleMouseDown = self.handleMouseDown.bind(self);
        self.handleMouseMove = self.handleMouseMove.bind(self);
        self.handleMouseUp = self.handleMouseUp.bind(self);

        const documentAddEventListener = document.addEventListener.bind(document);
        documentAddEventListener("mousedown", self.handleMouseDown);
        documentAddEventListener("mousemove", self.handleMouseMove);
        documentAddEventListener("mouseup", self.handleMouseUp);

        documentAddEventListener("touchstart", self.handleMouseDown, true);
        documentAddEventListener("touchmove", self.handleMouseMove, true);
        documentAddEventListener("touchend", self.handleMouseUp, true);
    }

    getDataLength() {
        return Math.max(...this.lines.map(line => line.data.length));
    }

    getMaxDataIndex() {
        return this.getDataLength() - 1;
    }

    addLines(lines: Line[]) {
        const self = this;

        self.lines.push(...lines);

        const maxIndex = self.getMaxDataIndex();
        const quarter = Math.round(maxIndex * INITIAL_BRUSH_SIZE);

        self.brushLinesContainer.append(...lines.map(line => line.getContainer()));
        self.interpolateWindowWidthToPoints = interpolate(0, maxIndex);
        
        self.window = [
            animation({ from: quarter, to: quarter, seconds: 0 }), 
            animation({ from: maxIndex, to: maxIndex, seconds: 0 }),
            maxIndex - quarter
        ];

        //
        const { startWith, exact: { length } } = self.getWindow();
        self.interpolatePointsToWindowWidth = interpolate(0, self.width);
        self.minimalWindowWidth = MINIMAL_POINTS_IN_VIEW * self.interpolatePointsToWindowWidth(1/maxIndex);
        self.windowWidth = self.interpolatePointsToWindowWidth(length / maxIndex);
        self.brushWindow.style.width = `${self.windowWidth}px`;
        self.position = self.interpolatePointsToWindowWidth(startWith / maxIndex);
        transform(self.brushWindow, translateX(self.position));

        self.emit('change', {
            window: self.window,
            position: self.position,
            action: BRUSH_WINDOW_DIRECTION.LEFT
        });
    }

    handleMouseDown(event: MouseEvent | TouchEvent) {
        const self = this;
        const { target, clientX } = handleEvent(event);
        const isClickOnBrushWindow = target === self.brushWindow;
        const isClickOnLeftHandle = target === self.brushLeftHandle;
        const isClickOnRightHandle = target === self.brushRightHandle;
        if (!isClickOnBrushWindow && !isClickOnRightHandle && !isClickOnLeftHandle) {
            return;
        }
        const rect = self.container.getBoundingClientRect();
        const brush = self.brushWindow.getBoundingClientRect();
        self.brushWindowDnDSession = {
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
        const self = this;
        if (!self.brushWindowDnDSession) {
            return;
        }

        render('brush move', () => {

            if (!self.brushWindowDnDSession) {
                return;
            }
            const { clientX: eventClientX } = handleEvent(event);

            const { exact: { endAt, length } } = self.getWindow();

            const { clientX, action, rect, brush } = self.brushWindowDnDSession;

            const px = eventClientX - rect.left;
            const points = self.interpolateWindowWidthToPoints(px / self.width);
            const delta = eventClientX - rect.left - clientX;

            if (
                action === BRUSH_WINDOW_DIRECTION.LEFT
            ) {
                self.updateStartWith({ 
                    points: Math.min(
                        points,
                        endAt - MINIMAL_POINTS_IN_VIEW
                    ) 
                });
                self.updatePosition();
                self.updateWindowWidth();
            }
            if (action === BRUSH_WINDOW_DIRECTION.MOVE) {
                const startWith = self.interpolateWindowWidthToPoints((brush.left - rect.left + delta) / self.width);
                const endAt = self.interpolateWindowWidthToPoints((brush.right - rect.left + delta) / self.width);
                const startTime = Date.now();
                if (delta < 0) {
                    const startWithNext = self.updateStartWith({
                        points: startWith,
                        startTime
                    });
                    self.updateEndAt({
                        points: startWithNext + length,
                        startTime
                    });
                } else {
                    const endAtNext = self.updateEndAt({
                        points: endAt,
                        startTime
                    });
                    self.updateStartWith({
                        points: endAtNext - length,
                        startTime
                    });
                }
                self.updatePosition();
            }
            if (action === BRUSH_WINDOW_DIRECTION.RIGHT) {
                self.updateEndAt({ points });
                self.updateWindowWidth();
            }
            
            self.emit('change', {
                window: self.window,
                position: self.position,
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
        transform(this.brushWindow, translateX(this.position));
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