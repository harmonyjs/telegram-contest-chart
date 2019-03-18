type ChartOptions = {
    container: Element | null
};

export default class Chart {

    constructor(private options: ChartOptions) {
        if (options.container === null) {
            throw new Error(`container options is mandatory`);
        }
        this.render();
    }

    render() {
        console.log(this);
    }

}