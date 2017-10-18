const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const multi = require("multistream");
const glob = require("glob");
const moment = require("moment");
require("moment-timezone");
const path = require("path");
const Jimp = require("jimp");
const stream = require("stream");

let mainPromise = Promise.resolve();

// glob makes quick work of getting the paths
glob("./screenshots/*.png", (er, files) => {
  const buckets = {};

  files.forEach(file => {
    const filename = path.basename(file);

    // this assumes a file name of `type_location-timestamp`
    const parts = filename.split("-", 1)[0].split("_", 2);

    // grab the details for the file to get modified time
    const stats = fs.statSync(file);
    const modTime = stats.mtime;
    const timeWithZone = moment(modTime).tz("America/New_York");

    // make the buckets
    // type -> location -> month -> day -> time of day -> [paths]
    const info = {
      type: parts[0],
      location: parts[1] || "indy",
      month: timeWithZone.month() + 1,
      day: timeWithZone.date(),
      timeOfDay: timeWithZone.hour() < 12 ? "morning" : "evening"
    };

    let bucket = buckets;
    Object.keys(info).forEach(bucketName => {
      const keyValue = info[bucketName];

      if (bucket[keyValue] === undefined) {
        bucket[keyValue] = bucketName !== "timeOfDay" ? {} : [];
      }

      bucket = bucket[keyValue];
    });

    bucket.push(file);
  });

  // buckets is full of paths, traverse those
  console.log("buckets", buckets);

  // this is a hot mess... could be improved
  // steps through different unique groups to get files together
  Object.keys(buckets).forEach(type => {
    Object.keys(buckets[type]).forEach(location => {
      Object.keys(buckets[type][location]).forEach(month => {
        Object.keys(buckets[type][location][month]).forEach(day => {
          Object.keys(
            buckets[type][location][month][day]
          ).forEach(timeOfDay => {
            console.log(type, location, month, day, timeOfDay);
            const segments = [type, location, month, day, timeOfDay];

            const name = segments.join("-");
            const files = buckets[type][location][month][day][timeOfDay];

            // this Promise is used to enforce a sequential processing of the movies
            mainPromise = mainPromise.then(() => {
              return movieFromFiles(files, name);
            });
          });
        });
      });
    });
  });
});

// create streams from each png created
function movieFromFiles(files, name) {
  var buffers = files.map(file => fs.readFileSync(file));

  console.log("making movie");
  console.log(name);

  // newStreams will hold all of the image streams to be stitched into a movie
  var newStreams = [];

  // this top part will add text to the image which is the timestamp
  // the Promises ensure that all images are modified before proceeding
  var allProm = buffers.map((incomingBuffer, index) => {
    return new Promise((resolve, reject) => {
      Jimp.read(incomingBuffer, (err, image) => {
        Jimp.loadFont(Jimp.FONT_SANS_128_BLACK).then(function(font) {
          const file = files[index];

          const stats = fs.statSync(file);
          const modTime = stats.mtime;
          const timeWithZone = moment(modTime).tz("America/New_York");
          const text = timeWithZone.format("HH:mm");

          image
            .print(font, 1200, 750, text)
            .getBuffer(Jimp.MIME_PNG, (err, buffer) => {
              // Initiate the source
              var bufferStream = new stream.PassThrough();

              // Write your buffer
              bufferStream.end(buffer);

              newStreams[index] = bufferStream;
              return resolve();
            });
        });
      });
    });
  });

  return new Promise((resolve, reject) => {
    // once all of the images are assembled, go ahead and process them
    Promise.all(allProm).then(() => {
      // combine those streams
      const multi_str = multi(newStreams);

      if (!fs.existsSync("./movies")) {
        fs.mkdirSync("./movies");
      }

      // create the ffmpeg call
      let command = ffmpeg();

      command
        // pipe the results in using a stream
        .input(multi_str)
        .inputFormat("image2pipe")
        // need a low input frame rate else frames will be dropped later
        .inputFPS(3)
        .fps(24)
        .videoCodec("libx264")
        // this ensure wide compat with players
        .outputOption("-pix_fmt yuv420p")
        // events for watch what happens
        .on("end", resolve)
        .on("error", reject)
        .on("start", function(commandLine) {
          console.log(commandLine);
        })
        .save("./movies/" + name + ".mp4");
    });
  });
}
