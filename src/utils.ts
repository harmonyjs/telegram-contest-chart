export type InterpolationFunction = (e: number) => number;

export function interpolate(a: number, b: number): InterpolationFunction {
    const c = +a;
    const d = b - c;
    return function(e: number, f?: number) {
        return c + d * e;
    };
}
