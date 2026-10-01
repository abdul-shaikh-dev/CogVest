import { startPerformanceProbe } from "../performanceProbe";

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it("reports local timer delay and cancels both timers", () => {
  jest.useFakeTimers();
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  const stop = startPerformanceProbe();
  jest.advanceTimersByTime(5000);
  expect(log).toHaveBeenCalledTimes(1);
  expect(JSON.parse(log.mock.calls[0][1])).toEqual({ samples: 100,
    windowMs: 5000, maximumDelayMs: 0 });
  stop();
  jest.advanceTimersByTime(5000);
  expect(log).toHaveBeenCalledTimes(1);
});

it("records a delayed heartbeat without emitting portfolio values", () => {
  jest.useFakeTimers();
  const clock = jest.spyOn(performance, "now").mockReturnValue(0);
  const log = jest.spyOn(console, "info").mockImplementation(() => {});
  const stop = startPerformanceProbe();
  clock.mockReturnValue(750);
  jest.advanceTimersByTime(50);
  clock.mockReturnValue(5000);
  jest.advanceTimersByTime(4950);
  const report = JSON.parse(log.mock.calls[0][1]);
  expect(report.maximumDelayMs).toBeGreaterThanOrEqual(700);
  expect(Object.keys(report).sort()).toEqual(["maximumDelayMs", "samples", "windowMs"]);
  stop();
});
