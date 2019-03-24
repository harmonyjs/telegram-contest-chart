export type InterpolationFunction = (e: number) => number;

export function interpolate(a: number, b: number): InterpolationFunction {
    const c = +a;
    const d = b - c;
    return function(e: number, f?: number) {
        return c + d * e;
    };
}

export function toInt(n: number): number {
    return n | 0;
}

export function minmax(min: number, value: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function easeInOutCubic(t: number): number { 
    return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 
};

export function linear(t: number) { 
    return t; 
};

export type AnimationOptions = {
    from: number, 
    to: number, 
    seconds: number,
    isLinear?: boolean,
    startTime?: number,
    callback?: Function
};

export type AnimationCallback = {
    (): number;
    from: number;
    to: number;
    finished: boolean;
}

export function animation(options: AnimationOptions): AnimationCallback {
    const { from, to, seconds, isLinear = false, startTime = Date.now(), callback } = options;
    const duration = seconds * 1000;
    const endTime = startTime + duration;
    const delta = to - from;
    const easing = isLinear ? linear : easeInOutCubic;
    function getValue() {
        if (delta === 0 || seconds === 0) {
            getValue.finished = true;
            return to;
        }
        if (getValue.finished) {
            return to;
        }
        const now = Date.now();
        const left = Math.max(0, endTime - now);
        const progress = easing((duration - left) / duration);
        if (progress === 1) {
            if (typeof callback === 'function') {
                callback();
            }
            getValue.finished = true;
            return to;
        }
        return (
            // Math.round((
                from + delta * progress
            // ) * 1000) / 1000
        );
    };
    getValue.from = from;
    getValue.to = to;
    getValue.finished = false;
    return getValue;
}

export function handleEvent(event: MouseEvent | TouchEvent) {
    if ((event as TouchEvent).changedTouches) {
        const e = event as TouchEvent;
        const touches = e.changedTouches;
        const first = touches[0];
        return {
            clientX: first.clientX,
            target: first.target
        }
    }
    const e = event as MouseEvent;
    return {
        clientX: e.clientX,
        target: e.target
    }
}