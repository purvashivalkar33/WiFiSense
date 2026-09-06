/* ============================================================
   WiFiSense
   Wireless Coverage, Dead-Zone & AP Optimization Simulator
   ============================================================ */

"use strict";

/* =========================
   GLOBAL STATE
========================= */

const state = {
    frequency: 2.4,
    power: 20,
    noise: -90,
    interference: 2,
    environment: "home",
    pathModel: "log",
    accessPoints: 1,

    router: {
        x: 0.47,
        y: 0.42
    },

    results: null
};


/* =========================
   DOM HELPERS
========================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


/* =========================
   NAVIGATION
========================= */

function showPage(pageId) {

    $$(".page").forEach(page => {
        page.classList.remove("active-page");
    });

    $$(".nav-btn").forEach(button => {
        button.classList.remove("active");
    });

    const page = document.getElementById(pageId);
    const navButton = document.querySelector(`[data-page="${pageId}"]`);

    if (page) page.classList.add("active-page");
    if (navButton) navButton.classList.add("active");
}


$$(".nav-btn").forEach(button => {

    button.addEventListener("click", () => {
        showPage(button.dataset.page);
    });

});


$("#launchSimulator").addEventListener("click", () => {
    showPage("simulator");
    setTimeout(runSimulation, 200);
});


/* =========================
   FREQUENCY
========================= */

$$(".freq-btn").forEach(button => {

    button.addEventListener("click", () => {

        $$(".freq-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        state.frequency = Number(button.dataset.frequency);

        runSimulation();

    });

});


/* =========================
   ACCESS POINTS
========================= */

$$(".ap-btn").forEach(button => {

    button.addEventListener("click", () => {

        $$(".ap-btn").forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");

        state.accessPoints = Number(button.dataset.ap);

        runSimulation();

    });

});


/* =========================
   SLIDERS
========================= */

$("#power").addEventListener("input", (event) => {

    state.power = Number(event.target.value);

    $("#powerValue").textContent =
        `${state.power} dBm`;

    runSimulation();

});


$("#noise").addEventListener("input", (event) => {

    state.noise = Number(event.target.value);

    $("#noiseValue").textContent =
        `${state.noise} dBm`;

    runSimulation();

});


$("#interference").addEventListener("input", (event) => {

    state.interference = Number(event.target.value);

    $("#interferenceValue").textContent =
        state.interference;

    runSimulation();

});


/* =========================
   SELECTS
========================= */

$("#environment").addEventListener("change", (event) => {

    state.environment = event.target.value;

    updateScenarioName();

    runSimulation();

});


$("#pathModel").addEventListener("change", (event) => {

    state.pathModel = event.target.value;

    runSimulation();

});


function updateScenarioName() {

    const names = {

        home: "Home Coverage",
        office: "Office Coverage",
        college: "College Coverage",
        hotel: "Hotel Coverage",
        warehouse: "Warehouse Coverage"

    };

    $("#scenarioName").textContent =
        names[state.environment];

}


/* =========================
   PHYSICS MODEL
========================= */

/*
    Simplified educational wireless propagation model.

    RSSI ≈ Transmit Power
           - Path Loss
           - Wall Attenuation
           - Interference

    This is a simulation model, not a replacement for
    professional RF survey equipment.
*/


function freeSpacePathLoss(distanceMeters) {

    const distance = Math.max(distanceMeters, 1);

    /*
        FSPL approximation:

        20log10(d) + 20log10(f) + constant
    */

    const frequencyMHz =
        state.frequency === 2.4 ? 2400 : 5000;

    return (
        20 * Math.log10(distance) +
        20 * Math.log10(frequencyMHz) -
        27.55
    );

}


function logDistancePathLoss(distanceMeters) {

    const distance = Math.max(distanceMeters, 1);

    let referenceLoss;

    if (state.frequency === 2.4) {
        referenceLoss = 40;
    } else {
        referenceLoss = 46;
    }

    const exponent =
        state.environment === "warehouse" ? 2.0 :
        state.environment === "office" ? 3.0 :
        state.environment === "college" ? 3.0 :
        state.environment === "hotel" ? 3.2 :
        2.7;

    return (
        referenceLoss +
        10 * exponent *
        Math.log10(distance)
    );

}


function indoorPathLoss(distanceMeters) {

    const distance = Math.max(distanceMeters, 1);

    const base =
        state.frequency === 2.4 ? 35 : 41;

    return (
        base +
        28 * Math.log10(distance)
    );

}


function calculatePathLoss(distanceMeters) {

    if (state.pathModel === "free") {
        return freeSpacePathLoss(distanceMeters);
    }

    if (state.pathModel === "indoor") {
        return indoorPathLoss(distanceMeters);
    }

    return logDistancePathLoss(distanceMeters);
}


/* =========================
   WALL ATTENUATION
========================= */

function calculateWallLoss(x1, y1, x2, y2) {

    /*
        Approximate wall crossing based on
        the three visual walls in the floor plan.
    */

    let loss = 0;

    const verticalWallX = 0.51;
    const horizontalWallY = 0.50;
    const secondVerticalWallX = 0.34;

    if (
        (x1 < verticalWallX && x2 > verticalWallX) ||
        (x1 > verticalWallX && x2 < verticalWallX)
    ) {
        loss += 6;
    }

    if (
        (y1 < horizontalWallY && y2 > horizontalWallY) ||
        (y1 > horizontalWallY && y2 < horizontalWallY)
    ) {
        loss += 7;
    }

    if (
        (x1 < secondVerticalWallX && x2 > secondVerticalWallX) ||
        (x1 > secondVerticalWallX && x2 < secondVerticalWallX)
    ) {
        loss += 5;
    }

    /*
        5 GHz is generally more sensitive
        to physical obstruction.
    */

    if (state.frequency === 5) {
        loss *= 1.15;
    }

    return loss;
}


/* =========================
   INTERFERENCE
========================= */

function calculateInterferenceLoss() {

    /*
        Each neighboring network contributes
        a simplified interference penalty.
    */

    return state.interference * 1.5;

}


/* =========================
   RSSI
========================= */

function calculateRSSI(x, y) {

    const dx = x - state.router.x;
    const dy = y - state.router.y;

    /*
        Convert normalized canvas distance into meters.
        Assume simulation area ≈ 25m × 18m.
    */

    const distance =
        Math.sqrt(
            Math.pow(dx * 25, 2) +
            Math.pow(dy * 18, 2)
        );

    const pathLoss =
        calculatePathLoss(distance);

    const wallLoss =
        calculateWallLoss(
            state.router.x,
            state.router.y,
            x,
            y
        );

    const interferenceLoss =
        calculateInterferenceLoss();

    let rssi =
        state.power -
        pathLoss -
        wallLoss -
        interferenceLoss;

    /*
        Keep simulation within a useful
        Wi-Fi range.
    */

    rssi = Math.max(-100, Math.min(-20, rssi));

    return rssi;
}


/* =========================
   SIGNAL QUALITY
========================= */

function signalCategory(rssi) {

    if (rssi >= -50) {
        return "excellent";
    }

    if (rssi >= -60) {
        return "good";
    }

    if (rssi >= -70) {
        return "fair";
    }

    if (rssi >= -80) {
        return "weak";
    }

    return "dead";

}


function calculateSNR(rssi) {

    return Math.max(
        0,
        rssi - state.noise -
        calculateInterferenceLoss()
    );

}


function qualityScore(coverage, averageRSSI, snr) {

    const coverageScore =
        Math.min(100, coverage);

    const rssiScore =
        Math.max(
            0,
            Math.min(
                100,
                ((averageRSSI + 90) / 50) * 100
            )
        );

    const snrScore =
        Math.max(
            0,
            Math.min(
                100,
                snr * 2.5
            )
        );

    return Math.round(
        coverageScore * 0.5 +
        rssiScore * 0.3 +
        snrScore * 0.2
    );

}


/* =========================
   HEATMAP
========================= */

function getSignalColor(rssi) {

    if (rssi >= -50) {
        return "rgba(80, 227, 164, 0.78)";
    }

    if (rssi >= -60) {
        return "rgba(139, 226, 139, 0.70)";
    }

    if (rssi >= -70) {
        return "rgba(255, 209, 102, 0.65)";
    }

    if (rssi >= -80) {
        return "rgba(255, 159, 67, 0.62)";
    }

    return "rgba(255, 92, 124, 0.58)";
}


function drawHeatmap() {

    const canvas = $("#heatmapCanvas");
    const wrapper = canvas.parentElement;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");

    ctx.scale(dpr, dpr);

    /*
        Dense grid creates a smooth-looking
        wireless heatmap.
    */

    const cellSize = 10;

    for (let y = 0; y < height; y += cellSize) {

        for (let x = 0; x < width; x += cellSize) {

            const normalizedX =
                x / width;

            const normalizedY =
                y / height;

            const rssi =
                calculateRSSI(
                    normalizedX,
                    normalizedY
                );

            ctx.fillStyle =
                getSignalColor(rssi);

            ctx.fillRect(
                x,
                y,
                cellSize + 1,
                cellSize + 1
            );

        }

    }

}


/* =========================
   SIMULATION
========================= */

function runSimulation(showToast = false) {

    drawHeatmap();

    const samples = [];

    const grid = 25;

    let categories = {
        excellent: 0,
        good: 0,
        fair: 0,
        weak: 0,
        dead: 0
    };

    let totalRSSI = 0;

    for (let y = 0; y < grid; y++) {

        for (let x = 0; x < grid; x++) {

            const nx = x / (grid - 1);
            const ny = y / (grid - 1);

            const rssi =
                calculateRSSI(nx, ny);

            const category =
                signalCategory(rssi);

            categories[category]++;

            totalRSSI += rssi;

            samples.push({
                x: nx,
                y: ny,
                rssi
            });

        }

    }


    const totalSamples =
        samples.length;

    const coverageSamples =
        categories.excellent +
        categories.good +
        categories.fair +
        categories.weak;

    const coverage =
        (coverageSamples / totalSamples) * 100;

    const dead =
        (categories.dead / totalSamples) * 100;

    const averageRSSI =
        totalRSSI / totalSamples;

    const averageSNR =
        calculateSNR(averageRSSI);

    const score =
        qualityScore(
            coverage,
            averageRSSI,
            averageSNR
        );


    state.results = {
        coverage,
        dead,
        averageRSSI,
        averageSNR,
        score,
        categories,
        samples
    };


    updateMetrics();
    updateAnalytics();


    if (showToast) {

        showToastMessage(
            "Analysis Complete",
            "Wireless coverage has been recalculated."
        );

    }

}


/* =========================
   METRICS
========================= */

function updateMetrics() {

    if (!state.results) return;

    $("#coverageMetric").textContent =
        `${state.results.coverage.toFixed(1)}%`;

    $("#deadMetric").textContent =
        `${state.results.dead.toFixed(1)}%`;

    $("#rssiMetric").textContent =
        `${state.results.averageRSSI.toFixed(1)} dBm`;

    $("#snrMetric").textContent =
        `${state.results.averageSNR.toFixed(1)} dB`;

}


/* =========================
   ANALYTICS
========================= */

function updateAnalytics() {

    const r = state.results;

    if (!r) return;


    $("#analyticsRSSI").textContent =
        `${r.averageRSSI.toFixed(1)} dBm`;

    $("#qualityScore").textContent =
        r.score;


    let label = "Poor";

    if (r.score >= 85) {
        label = "Excellent Network";
    } else if (r.score >= 70) {
        label = "Good Network";
    } else if (r.score >= 50) {
        label = "Moderate Network";
    }

    $("#qualityLabel").textContent =
        label;


    const total =
        Object.values(r.categories)
            .reduce((a, b) => a + b, 0);


    const percentages = {

        excellent:
            r.categories.excellent / total * 100,

        good:
            r.categories.good / total * 100,

        fair:
            r.categories.fair / total * 100,

        weak:
            r.categories.weak / total * 100,

        dead:
            r.categories.dead / total * 100

    };


    $("#excellentPct").textContent =
        `${percentages.excellent.toFixed(1)}%`;

    $("#goodPct").textContent =
        `${percentages.good.toFixed(1)}%`;

    $("#fairPct").textContent =
        `${percentages.fair.toFixed(1)}%`;

    $("#weakPct").textContent =
        `${percentages.weak.toFixed(1)}%`;

    $("#deadPct").textContent =
        `${percentages.dead.toFixed(1)}%`;


    setTimeout(() => {

        $("#excellentBar").style.width =
            `${percentages.excellent}%`;

        $("#goodBar").style.width =
            `${percentages.good}%`;

        $("#fairBar").style.width =
            `${percentages.fair}%`;

        $("#weakBar").style.width =
            `${percentages.weak}%`;

        $("#deadBar").style.width =
            `${percentages.dead}%`;

    }, 50);


    const interference =
        state.interference;

    const noisePenalty =
        Math.max(0, -70 - state.noise);

    const interferenceScore =
        Math.min(
            100,
            interference * 9 +
            noisePenalty
        );


    $("#interferenceBar").style.width =
        `${interferenceScore}%`;


    if (interferenceScore < 25) {

        $("#analyticsInterference").textContent =
            "LOW";

    } else if (interferenceScore < 60) {

        $("#analyticsInterference").textContent =
            "MODERATE";

    } else {

        $("#analyticsInterference").textContent =
            "HIGH";

    }

}


/* =========================
   ROUTER DRAGGING
========================= */

const routerMarker =
    $("#routerMarker");

const floorPlan =
    $("#floorPlan");

let draggingRouter = false;


routerMarker.addEventListener(
    "mousedown",
    () => {
        draggingRouter = true;
    }
);


document.addEventListener(
    "mouseup",
    () => {
        draggingRouter = false;
    }
);


floorPlan.addEventListener(
    "mousemove",
    (event) => {

        if (!draggingRouter) return;

        const rect =
            floorPlan.getBoundingClientRect();

        let x =
            (event.clientX - rect.left) /
            rect.width;

        let y =
            (event.clientY - rect.top) /
            rect.height;


        x = Math.max(0.04, Math.min(0.96, x));
        y = Math.max(0.04, Math.min(0.96, y));


        state.router.x = x;
        state.router.y = y;


        routerMarker.style.left =
            `calc(${x * 100}% - 27px)`;

        routerMarker.style.top =
            `calc(${y * 100}% - 27px)`;


        drawHeatmap();

        runSimulation();

    }
);


/* =========================
   RESET
========================= */

$("#resetSimulation")
    .addEventListener(
        "click",
        () => {

            state.frequency = 2.4;
            state.power = 20;
            state.noise = -90;
            state.interference = 2;
            state.environment = "home";
            state.pathModel = "log";
            state.accessPoints = 1;

            state.router.x = 0.47;
            state.router.y = 0.42;


            $("#power").value = 20;
            $("#noise").value = -90;
            $("#interference").value = 2;

            $("#powerValue").textContent =
                "20 dBm";

            $("#noiseValue").textContent =
                "-90 dBm";

            $("#interferenceValue").textContent =
                "2";


            $("#environment").value =
                "home";

            $("#pathModel").value =
                "log";


            $$(".freq-btn").forEach(btn => {
                btn.classList.toggle(
                    "active",
                    btn.dataset.frequency === "2.4"
                );
            });


            $$(".ap-btn").forEach(btn => {
                btn.classList.toggle(
                    "active",
                    btn.dataset.ap === "1"
                );
            });


            routerMarker.style.left =
                "calc(47% - 27px)";

            routerMarker.style.top =
                "calc(42% - 27px)";


            updateScenarioName();

            runSimulation();


            showToastMessage(
                "Simulation Reset",
                "Default network configuration restored."
            );

        }
    );


/* =========================
   ANALYZE BUTTON
========================= */

$("#runAnalysis")
    .addEventListener(
        "click",
        () => {

            /*
                Small visual delay makes the
                analysis feel like a real process.
            */

            const button =
                $("#runAnalysis");

            const original =
                button.textContent;

            button.textContent =
                "⟳ Analyzing...";

            button.disabled = true;

            setTimeout(() => {

                runSimulation(true);

                button.textContent =
                    original;

                button.disabled = false;

            }, 800);

        }
    );


/* =========================
   OPTIMIZATION
========================= */

$("#optimizeBtn")
    .addEventListener(
        "click",
        optimizeRouter
    );


function optimizeRouter() {

    const visual =
        $(".optimization-visual");

    visual.classList.add("optimizing");

    $("#scanStatus").textContent =
        "SCANNING CANDIDATE LOCATIONS...";

    $("#recommendationTitle").textContent =
        "Optimization in progress";

    $("#recommendationText").textContent =
        "Evaluating candidate access-point positions...";


    let best = null;

    /*
        Grid-search optimization.

        The system tests candidate router positions
        and chooses the one with the highest score.
    */

    for (let y = 0.10; y <= 0.90; y += 0.05) {

        for (let x = 0.10; x <= 0.90; x += 0.05) {

            const oldX = state.router.x;
            const oldY = state.router.y;

            state.router.x = x;
            state.router.y = y;


            const result =
                calculateCandidatePerformance();


            if (
                !best ||
                result.score > best.score
            ) {

                best = {
                    x,
                    y,
                    ...result
                };

            }


            state.router.x = oldX;
            state.router.y = oldY;

        }

    }


    setTimeout(() => {

        state.router.x = best.x;
        state.router.y = best.y;


        routerMarker.style.left =
            `calc(${best.x * 100}% - 27px)`;

        routerMarker.style.top =
            `calc(${best.y * 100}% - 27px)`;


        drawHeatmap();

        runSimulation();


        $("#scanStatus").textContent =
            "OPTIMAL POSITION FOUND";

        $("#recommendationTitle").textContent =
            "🏆 Optimal Access Point Position";

        $("#recommendationText").textContent =
            `The optimizer evaluated candidate positions and selected a location that maximizes simulated coverage while reducing dead-zone area.`;


        $("#optimizedCoverage").textContent =
            `${best.coverage.toFixed(1)}%`;

        $("#optimizedDead").textContent =
            `${best.dead.toFixed(1)}%`;

        $("#optimizedRSSI").textContent =
            `${best.averageRSSI.toFixed(1)} dBm`;


        visual.classList.remove("optimizing");


        showToastMessage(
            "Optimization Complete",
            "Best simulated access-point position found."
        );

    }, 1300);

}


/* =========================
   CANDIDATE PERFORMANCE
========================= */

function calculateCandidatePerformance() {

    const grid = 18;

    let totalRSSI = 0;

    let covered = 0;

    let dead = 0;

    for (let y = 0; y < grid; y++) {

        for (let x = 0; x < grid; x++) {

            const nx =
                x / (grid - 1);

            const ny =
                y / (grid - 1);

            const rssi =
                calculateRSSI(nx, ny);

            totalRSSI += rssi;

            if (rssi >= -80) {
                covered++;
            } else {
                dead++;
            }

        }

    }


    const total =
        grid * grid;

    const coverage =
        covered / total * 100;

    const deadPct =
        dead / total * 100;

    const averageRSSI =
        totalRSSI / total;


    const score =
        coverage * 0.7 +
        Math.max(
            0,
            (averageRSSI + 100)
        ) * 0.3;


    return {
        coverage,
        dead: deadPct,
        averageRSSI,
        score
    };

}


/* =========================
   DEMO MODE
========================= */

$("#demoMode")
    .addEventListener(
        "click",
        runDemo
    );


async function runDemo() {

    showPage("simulator");

    const steps = [

        "Initializing wireless environment...",

        "Loading indoor floor plan...",

        "Placing access point...",

        "Calculating propagation loss...",

        "Analyzing wall attenuation...",

        "Calculating interference and SNR...",

        "Generating coverage heatmap...",

        "Detecting dead zones..."

    ];


    for (const step of steps) {

        showToastMessage(
            "WiFiSense Demo",
            step
        );

        await wait(450);

    }


    runSimulation(true);


    await wait(500);

    showPage("optimization");

    showToastMessage(
        "Demo",
        "Running intelligent placement optimization..."
    );


    await wait(500);

    optimizeRouter();

}


function wait(ms) {

    return new Promise(
        resolve => setTimeout(resolve, ms)
    );

}


/* =========================
   REPORT GENERATOR
========================= */

$("#generateReport")
    .addEventListener(
        "click",
        generateReport
    );


function generateReport() {

    if (!state.results) {
        runSimulation();
    }


    const r =
        state.results;


    const environment =
        $("#environment").selectedOptions[0].textContent;


    const frequency =
        state.frequency === 2.4
            ? "2.4 GHz"
            : "5 GHz";


    $("#reportContent").innerHTML = `

        <div class="report-section">

            <h4>NETWORK CONFIGURATION</h4>

            <div class="report-row">
                <span>Environment</span>
                <strong>${environment}</strong>
            </div>

            <div class="report-row">
                <span>Frequency</span>
                <strong>${frequency}</strong>
            </div>

            <div class="report-row">
                <span>Transmit Power</span>
                <strong>${state.power} dBm</strong>
            </div>

            <div class="report-row">
                <span>Path Loss Model</span>
                <strong>${state.pathModel}</strong>
            </div>

            <div class="report-row">
                <span>Access Points</span>
                <strong>${state.accessPoints}</strong>
            </div>

        </div>


        <div class="report-section">

            <h4>COVERAGE ANALYSIS</h4>

            <div class="report-row">
                <span>Total Coverage</span>
                <strong>${r.coverage.toFixed(1)}%</strong>
            </div>

            <div class="report-row">
                <span>Dead Zone</span>
                <strong>${r.dead.toFixed(1)}%</strong>
            </div>

            <div class="report-row">
                <span>Average RSSI</span>
                <strong>${r.averageRSSI.toFixed(1)} dBm</strong>
            </div>

            <div class="report-row">
                <span>Average SNR</span>
                <strong>${r.averageSNR.toFixed(1)} dB</strong>
            </div>

            <div class="report-row">
                <span>Network Quality</span>
                <strong>${r.score}/100</strong>
            </div>

        </div>


        <div class="report-section">

            <h4>RECOMMENDATION</h4>

            <div class="report-row">
                <span>Recommended Action</span>
                <strong>
                    ${r.dead > 15
                        ? "Reposition / add AP"
                        : "Current placement is acceptable"}
                </strong>
            </div>

            <div class="report-row">
                <span>Interference</span>
                <strong>
                    ${state.interference < 3
                        ? "Low"
                        : state.interference < 6
                            ? "Moderate"
                            : "High"}
                </strong>
            </div>

        </div>

    `;


    $("#reportModal")
        .classList.add("show");

}


/* =========================
   REPORT MODAL
========================= */

$("#closeModal")
    .addEventListener(
        "click",
        () => {
            $("#reportModal")
                .classList.remove("show");
        }
    );


$("#reportModal")
    .addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                $("#reportModal")
            ) {

                $("#reportModal")
                    .classList.remove("show");

            }

        }
    );


$("#printReport")
    .addEventListener(
        "click",
        () => {
            window.print();
        }
    );


/* =========================
   TOAST
========================= */

let toastTimer;

function showToastMessage(title, message) {

    $("#toastTitle").textContent =
        title;

    $("#toastMessage").textContent =
        message;

    $("#toast").classList.add("show");


    clearTimeout(toastTimer);

    toastTimer =
        setTimeout(() => {

            $("#toast")
                .classList.remove("show");

        }, 3000);

}


/* =========================
   INITIALIZATION
========================= */

window.addEventListener(
    "resize",
    () => {

        if (
            $("#simulator")
                .classList.contains("active-page")
        ) {

            drawHeatmap();

        }

    }
);


updateScenarioName();

runSimulation();

console.log(
    "%cWiFiSense initialized successfully.",
    "color:#59d9ff;font-size:14px;font-weight:bold;"
);

console.log(
    "Wireless Coverage & Dead-Zone Simulation Engine Ready."
);