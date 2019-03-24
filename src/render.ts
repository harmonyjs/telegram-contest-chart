import { FRAME_RATE_LIMIT } from './constants';

export type DrawTask = () => void;

let isRunning = false;

let drawTasks: {
    [type: string]: DrawTask
} = {};

let last = 0;

function loop() {
    isRunning = true;
    requestAnimationFrame((t)=> {
        if (t - last < FRAME_RATE_LIMIT) {
            loop();
            return;
        }
        last = t;
        const keys = Object.keys(drawTasks);
        if (!keys.length) {
            isRunning = false;
            return;
        }
        const tasks = drawTasks;
        drawTasks = {};
        while(keys.length) {
            const taskKey = keys.shift() || '';
            const task = tasks[taskKey];
            if (task) {
                task();
            }
        }
        loop();
    });
}

export default function render(type: string, task: DrawTask) {
    if (drawTasks[type]) {
        // duplicate
        return;
    }
    drawTasks[type] = task;
    if (!isRunning) {
        loop();
    }
}