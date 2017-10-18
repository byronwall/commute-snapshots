const ffmpeg = require("fluent-ffmpeg");

let command = ffmpeg();

const inputPath = "./examples/overview-indy-10-6-morning.mp4";

command
  // pipe the results in using a stream
  .input(inputPath)
  // need a low input frame rate else frames will be dropped later
  // this ensure wide compat with players
  // events for watch what happens
  .size("940x?")
  .on("start", function(commandLine) {
    console.log(commandLine);
  })
  .save(inputPath + ".gif");
