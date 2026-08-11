import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "1m", target: 200 },
        { duration: "30s", target: 0 },
    ],
};

export default function () {
    const url = "https://localhost:56510/api/Chat/stream";

    const payload = JSON.stringify({
        question: "Hvordan bruker jeg MDS?",
        messages: [],
        topK: 4,
    });

    const params = {
        headers: {
            "Content-Type": "application/json",
        },
        timeout: "60s",
    };

    const res = http.post(url, payload, params);

    check(res, {
        "status is 200": (r) => r.status === 200,
        "response time under 60s": (r) => r.timings.duration < 60000,
    });

    sleep(1);
}