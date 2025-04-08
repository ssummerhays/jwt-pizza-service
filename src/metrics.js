const config = require("./config");
const os = require("os");

const interval = 100_000_000;

const requests = {};
let activeUsers = 0;

let successfulAuth = 0;
let failedAuth = 0;

let pizzasSold = 0;
let failedCreations = 0;
let revenue = 0;

let httpTime = 0;

let pizzaTime = 0;

function track(endpoint) {
  return (req, res, next) => {
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    next();
  };
}

function addUser(req, res, next) {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      activeUsers += 1;
    }
  });
  next();
}

function subtractUser(req, res, next) {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      activeUsers -= 1;
    }
  });
  next();
}

function trackAuth(result) {
  if (result == "success") {
    successfulAuth += 1;
  } else {
    failedAuth += 1;
  }
}

function trackPizzas(result, price) {
  if (result == "success") {
    pizzasSold += 1;
    revenue += price;
  } else {
    failedCreations += 1;
  }
}

function timeRequests(req, res, next) {
  const start = Date.now();
  let duration;

  res.on("finish", () => {
    duration = Date.now() - start;
    httpTime += duration;
  });

  next();
}

function timePizza(req, res, next) {
  const start = Date.now();
  let duration;

  res.on("finish", () => {
    const end = Date.now();
    duration = end - start;

    pizzaTime += duration;
  });

  next();
}

const timer = setInterval(() => {
  Object.keys(requests).forEach((endpoint) => {
    sendMetricToGrafana("requests", requests[endpoint], { endpoint });
  });

  sendMetricToGrafana("authentication", successfulAuth, {
    result: "successful",
  });
  sendMetricToGrafana("authentication", failedAuth, { result: "failed" });

  sendMetricToGrafana("users", activeUsers, { users: "users" });

  const cpuUsage = getCpuUsagePercentage();
  sendDoubleMetricToGrafana("system", cpuUsage, { system: "cpuUsage" });

  const memoryUsage = getMemoryUsagePercentage();
  sendDoubleMetricToGrafana("system", memoryUsage, { system: "memoryUsage" });

  sendMetricToGrafana("pizzas", pizzasSold, { metric: "pizzasSold" });
  sendMetricToGrafana("pizzas", failedCreations, { metric: "failedCreations" });
  sendDoubleMetricToGrafana("pizzas", revenue, { metric: "revenue" });

  sendDoubleMetricToGrafana("latency", httpTime, {
    latency: "http",
  });

  sendDoubleMetricToGrafana("latency", pizzaTime, {
    latency: "pizza",
  });
}, interval);

function sendDoubleMetricToGrafana(metricName, metricValue, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      asDouble: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push(
      {
        key: key,
        value: { stringValue: attributes[key] },
      }
    );
  });

  fetch(`${config.metrics.url}`, {
    method: "POST",
    body: JSON.stringify(metric),
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error("Failed to push metrics data to Grafana");
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

function sendMetricToGrafana(metricName, metricValue, attributes) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push(
      {
        key: key,
        value: { stringValue: attributes[key] },
      }
    );
  });

  fetch(`${config.metrics.url}`, {
    method: "POST",
    body: JSON.stringify(metric),
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error("Failed to push metrics data to Grafana");
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

module.exports = {
  track,
  addUser,
  subtractUser,
  trackAuth,
  trackPizzas,
  timeRequests,
  timePizza,
  timer,
};
