export const LINE_TYPE = 'line';
export const X_TYPE = 'x';
export const FRAME_RATE_LIMIT = 16;

export const EXTRA_POINTS_ON_THE_LEFT = 1;
export const EXTRA_POINTS_ON_THE_RIGHT = 1;
export const SHOULD_COUNT_EXTRA_POINT_IN_MAX = false; 
export const MINIMAL_POINTS_IN_VIEW = 1;
export const X_AXIS_ANIMATION_DURATION = .1; 
export const Y_AXIS_ANIMATION_DURATION = .33;
export const Y_TICK_HEIGHT = 43;
export const MAIN_LINE_WIDTH = 2;
export const BRUSH_LINE_WIDTH = 1;

export const BRUSH_HEIGHT = 50; // look at corresponding value in css
export const WIDTH_HEIGHT_RATIO = 0.5; // look at corresponding value in css

export const CHART_PADDING = 12;
export const CHART_POINTS_PADDING_RIGHT = 6;
export const CHART_POINTS_PADDING_TOP = 20;

export const INITIAL_BRUSH_SIZE = 0.6;

export enum BRUSH_WINDOW_DIRECTION {
    LEFT = 1,
    RIGHT = -1,
    MOVE = 0
}