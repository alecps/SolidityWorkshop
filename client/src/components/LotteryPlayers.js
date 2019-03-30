import React from "react";
import { ButtonToolbar, Button } from "react-bootstrap";

import "./../App.css";
import { stat } from "fs";

class LotteryPlayers extends React.Component {
	constructor(props) {
		super(props);
		const drizzleState = this.props.drizzleState;

		const contract = this.props.drizzle.contracts.Lottery;
		const ticketDataKey = contract.methods["_ticketPrice"].cacheCall();
		const issuedDataKey = contract.methods["_ticketsIssued"].cacheCall();

		this.state = {
			ticketPrice: ticketDataKey,
			ticketsIssued: issuedDataKey,
			users: Object.keys(drizzleState.accounts).length,
			addresses: Object.values(drizzleState.accounts)
		};
		this.renderUsers = this.renderUsers.bind(this);
		this.renderControls = this.renderControls.bind(this);
		this.decreaseUsers = this.decreaseUsers.bind(this);
		this.incrementUsers = this.incrementUsers.bind(this);

		console.log(this.props.drizzle);
		console.log(this.state);
		console.log(this.props.drizzleState);
	}

	renderUsers() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;

		const items = this.state.addresses.map(a => {
			if (this.state.addresses.indexOf(a) < this.state.users) {
				return (
					<div className='card' key={a}>
						<span>{this.state.addresses.indexOf(a)}</span>
						<div>
							<br />
							Balance: {web3.utils.fromWei(ds.accountBalances[a])}
							<span style={{ fontSize: "12px" }}> ether</span>
						</div>
					</div>
				);
			}
		});
		return items;
	}

	decreaseUsers() {
		if (this.state.users > 1) {
			this.setState({ users: this.state.users - 1 });
		}
	}

	incrementUsers() {
		if (this.state.users < this.state.addresses.length) {
			this.setState({ users: this.state.users + 1 });
		}
	}

	renderControls() {
		const { Lottery } = this.props.drizzleState.contracts;
		const ticketPrice = Lottery._ticketPrice[this.state.ticketPrice];
		const ticketsIssued = Lottery._ticketsIssued[this.state.ticketsIssued];

		return (
			<div>
				<ButtonToolbar>
					<Button onClick={this.decreaseUsers}>-</Button>
					<Button onClick={this.incrementUsers}>+</Button>
				</ButtonToolbar>
				<p>Ticket Price: {ticketPrice && ticketPrice.value}</p>
				<p>Tickets Issued: {ticketsIssued && ticketsIssued.value}</p>
			</div>
		);
	}

	render() {
		return (
			<div>
				<div className='controls-container'>{this.renderControls()}</div>
				<div className='players-container'>{this.renderUsers()}</div>
			</div>
		);
	}
}

export default LotteryPlayers;
