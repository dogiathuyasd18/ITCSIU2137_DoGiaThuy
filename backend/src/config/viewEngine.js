import express from "express";

let configViewEngine = (app) => {
    app.use(express.static("./src/public"));
    app.set("view engine", "ejs");
    // Views are stored under src/public/templates in this repo
    app.set("views", "./src/public/templates");
}

export default configViewEngine;