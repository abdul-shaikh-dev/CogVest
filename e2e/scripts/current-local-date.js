const now = new Date();
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

output.currentLocalDate = `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
