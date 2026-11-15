// Runs once before Jest starts its workers, which inherit the environment.
// Tests run in India Standard Time, the zone CogVest's users are in, unless
// TZ is already set; CI also runs the suite once with TZ=UTC (#673).
module.exports = () => {
  process.env.TZ = process.env.TZ || "Asia/Kolkata";
};
