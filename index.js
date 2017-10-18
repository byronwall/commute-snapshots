const puppeteer = require("puppeteer");
const schedule = require("node-schedule");
const fs = require("fs");

// expected to run from 6 AM EST to 9 AM and then again at 4 PM EST

var j = schedule.scheduleJob("0 */10 4,5,6,14,15,16 * * *", function() {
  console.log("job execution running...");
  processScreenshot();
});

console.log("job execution scheduled...");

function processScreenshot() {
  const links = {
    overview: [
      "https://www.google.com/maps/@39.8191984,-86.1719624,11z/data=!5m1!1e1",
      "https://www.google.com/maps/@39.8191984,-86.1719624,11z/data=!5m1!1e1"
    ],
    traffic_indyToCarmel: [
      "https://www.google.com/maps/dir/Indianapolis,+IN/Carmel,+IN/@39.8293896,-86.1743666,11z/data=!4m8!4m7!1m2!1m1!1s0x886b50ffa7796a03:0xd68e9df640b9ea7c!1m2!1m1!1s0x8814ad973033fa1d:0x43b9095f5f7b38fc!3e0",
      "https://www.google.com/maps/dir/Carmel,+IN/Indianapolis,+IN/@39.8732154,-86.1537792,11z/data=!4m8!4m7!1m2!1m1!1s0x8814ad973033fa1d:0x43b9095f5f7b38fc!1m2!1m1!1s0x886b50ffa7796a03:0xd68e9df640b9ea7c!3e0"
    ]
  };

  console.log(new Date());

  Object.keys(links).forEach(key => {
    (async () => {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      const time = new Date();

      if (!fs.existsSync("./screenshots")) {
        fs.mkdirSync("./screenshots");
      }

      const path = "./screenshots/" + key + "-" + time.getTime() + ".png";
      const url = time.getHours() < 12 ? links[key][0] : links[key][1];

      // these size settings were found by trial and error
      await page.setViewport({ width: 1680, height: 1000 });
      await page.goto(url);
      await page.waitFor(5000);
      await page.screenshot({ path });

      await browser.close();

      console.log(key);
    })();
  });
}
