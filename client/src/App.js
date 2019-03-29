import React, { Component } from "react";
import logo from "./logo.png";
import "./App.css";

class App extends Component {
	state = {
		loading: true,
		drizzleState: null
	};

	componentDidMount() {
		const { drizzle } = this.props;
		// subscribe to changes in the store
		this.unsubscribe = drizzle.store.subscribe(() => {
			// every time the store updates, grab the state from drizzle
			const drizzleState = drizzle.store.getState();

			// check to see if it's ready, if so, update local component state
			if (drizzleState.drizzleStatus.initialized) {
				this.setState({
					loading: false,
					drizzleState
				});
			}
		});
	}

	componentWillUnmount() {
		this.unsubscribe();
	}

	render() {
		if (this.state.loading) return "Loading Drizzle...";

		return (
			<div className='App'>
				<div className='section landing-section'>
					<img src={logo} className='logo' alt='logo' />
				</div>
				<div className='body' />
				<section className='section footer'>
					<div className='footer-content'>
						<div className='copyright'>
							Copyright & copy; Fintech at Brown.All Rights Reserved.{" "}
						</div>
					</div>
				</section>
			</div>
		);
	}
}

export default App;
