import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import App from "./App";
import * as serviceWorker from "./serviceWorker";
import { BrowserRouter } from "react-router-dom";

// import drizzle functions and contract artifact
import { Drizzle, generateStore } from "drizzle";
import Lottery from "./contracts/Lottery.json";

// let drizzle know what contracts we want and how to access our test blockchain
const options = {
	contracts: [Lottery],
	web3: {
		fallback: {
			type: "ws",
			url: "ws://127.0.0.1:8545"
		}
	}
};

// setup the drizzle store and drizzle
const drizzle = new Drizzle(options);

ReactDOM.render(
	<BrowserRouter>
		<App drizzle={drizzle} />{" "}
	</BrowserRouter>,
	document.getElementById("root")
);
