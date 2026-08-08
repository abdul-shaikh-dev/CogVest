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

const day = String(now.getDate()).padStart(2, "0");

output.currentLocalDate = `${day} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
