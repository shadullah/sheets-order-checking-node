const { google } = require("googleapis");

const extractSheetId = (url) => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

const url =
  "https://docs.google.com/spreadsheets/d/13bFvk1TauQLYIYphr4XE8UitShbfrqLnQWtkeXw9eWs/edit?gid=1490546788#gid=1490546788";

const spreadsheetId = extractSheetId(url);
const apiKey = "AIzaSyBK5TckwP-yak1in51-EoR0GGNyZWktfvU";
const startDate = "01-01-2023";
const endDate = "06-01-2023";

const initSheet = async () => {
  return google.sheets({
    version: "v4",
    auth: apiKey,
  });
};

const fetchSheet = async () => {
  try {
    const sheet = await initSheet();

    const response = await sheet.spreadsheets.get({
      spreadsheetId,
    });
    // console.log(url);
    console.log(response);
    console.log(
      "Available sheets: ",
      response.data.sheets.map((sheet) => sheet.properties.title)
    );

    const ordersRes = await sheet.spreadsheets.values.get({
      spreadsheetId,
      range: "Orders!A:B",
    });
    const lineItemRes = await sheet.spreadsheets.values.get({
      spreadsheetId,
      range: "LineItems!A:C",
    });

    if (!ordersRes || !lineItemRes) {
      throw new error("No data found in sheet");
    }

    console.log("sample orders: ", ordersRes.data.values.slice(0, 3));
    console.log("sample orders: ", lineItemRes.data.values.slice(0, 3));

    return {
      orders: ordersRes.data.values.slice(1),
      lineItems: lineItemRes.data.values.slice(1),
    };
  } catch (error) {
    if (error.response) {
      console.log("Detailed error: ", error.response.data);
      throw new Error(`API ERROR: ${error.response.data.error.message}`);
    }
    throw error;
  }
};

const parseDate = (dateStr) => {
  const [day, month, year] = dateStr.split("-").map(Number);
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day);
};

const formattedDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const findBestDay = async () => {
  try {
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (start > end) {
      throw new Error("Start date must be before or equal to end date");
    }

    const { orders, lineItems } = await fetchSheet();

    const orderDates = new Map(
      orders.map(([orderId, dateStr]) => {
        const date = parseDate(dateStr.trim());
        return [orderId.trim(), date];
      })
    );

    const orderPrices = new Map();
    for (const [, orderId, price] of lineItems) {
      const currentTotal = orderPrices.get(orderId.trim()) || 0;
      orderPrices.set(orderId.trim(), currentTotal + Number(price));
    }

    let bestDate = start;
    let minRefundAmount = Infinity;

    console.log(
      `Analyzing dates from ${formattedDate(start)} to ${formattedDate(end)}`
    );

    for (
      let date = new Date(start);
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      let refundAmount = 0;

      for (const [orderId, orderDate] of orderDates.entries()) {
        if (
          orderDate >= start &&
          orderDate <= end &&
          orderDate.getTime() !== date.getTime()
        ) {
          refundAmount += orderPrices.get(orderId) || 0;
        }
      }
      console.log(
        `Date ${formattedDate(date)}: Refund amount = ${refundAmount}`
      );

      if (refundAmount < minRefundAmount) {
        minRefundAmount = refundAmount;
        bestDate = new Date(date);
        console.log(
          `New best date found: ${formattedDate(
            bestDate
          )} with refund: ${minRefundAmount}`
        );
      }
    }

    return { bestDay: formattedDate(bestDate), totalRefund: minRefundAmount };
  } catch (error) {
    console.log("Error:", error.message);
    throw error;
  }
};

findBestDay()
  .then(({ bestDay, totalRefund }) => {
    console.log("best day to save: ", bestDay);
    console.log("minimum refund amount: ", totalRefund);
  })
  .catch((error) => console.log("program failed: ", error.message));
