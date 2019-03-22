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
    isLinear?: boolean
};

export type AnimationCallback = () => number;

export function animation(options: AnimationOptions): AnimationCallback {
    const { from, to, seconds, isLinear = false } = options;
    const startTime = Date.now();
    const duration = seconds * 1000;
    const endTime = startTime + duration;
    const delta = to - from;
    const easing = isLinear ? linear : easeInOutCubic;
    let finished = false;
    const getValue = function() {
        if (finished) {
            return to;
        }
        const now = Date.now();
        const left = Math.max(0, endTime - now);
        const progress = easing((duration - left) / duration);
        if (progress === 1) {
            finished = true;
            return to;
        }
        // console.log({
        //     now, left, progress, fn: easeInOutCubic(progress), delta, from
        // });
        return from + delta * progress;
    };
    return getValue;
}