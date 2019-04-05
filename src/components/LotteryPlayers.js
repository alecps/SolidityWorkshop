import React from "react";
import "react-tippy/dist/tippy.css";
import { Tooltip } from "react-tippy";

import "./../App.css";

class LotteryPlayers extends React.Component {
	constructor(props) {
		super(props);
		const drizzleState = this.props.drizzleState;
		let addresses = Object.values(drizzleState.accounts);

		const contract = this.props.drizzle.contracts.Lottery;
		const idDataKey = contract.methods["_lotteryID"].cacheCall();
		const activeKey = contract.methods["_active"].cacheCall();
		const timeLastActivatedKey = contract.methods["_timeLastActivated"].cacheCall();
		const saleTimeoutKey = contract.methods["_saleTimeout"].cacheCall();
		const revealTimeoutKey = contract.methods["_revealTimeout"].cacheCall();
		const ticketDataKey = contract.methods["_ticketPrice"].cacheCall();
		const issuedDataKey = contract.methods["_ticketsIssued"].cacheCall();

		const balanceDataKey = [];
		for (let i = 0; i < addresses.length; i++) {
			balanceDataKey.push(contract.methods["_ticketBalances"].cacheCall(addresses[i]));
		}

		this.state = {
			ticketPrice: ticketDataKey,
			ticketsIssued: issuedDataKey,
			users: Object.keys(drizzleState.accounts).length,
			addresses: addresses,
			ticketBalances: balanceDataKey,
			active: activeKey,
			timeLastActivated: timeLastActivatedKey,
			saleTimeout: saleTimeoutKey,
			ticketAmountInputs: [],
			passwords: []
		};

		this.saleActive = this.saleActive.bind(this);

		console.log(this.props.drizzle);
		console.log(this.props.drizzleState);
	}

	handleOwnerChange(type, event) {
		if (type === "price") {
			this.setState({ ticketPriceInput: event.target.value });
		} else if (type === "sale") {
			this.setState({ saleDurationInput: event.target.value });
		} else {
			this.setState({ lotteryDurationInput: event.target.value });
		}
	}

	startLottery() {
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		if (
			s.ticketPriceInput > 0 &&
			s.saleDurationInput > 0 &&
			s.lotteryDurationInput > s.saleDurationInput
		) {
			let convertedPrice = web3.utils.toWei(s.ticketPriceInput);
			const stackId = Lottery.methods["activate"].cacheSend(
				convertedPrice,
				s.saleDurationInput * 60,
				s.lotteryDurationInput * 60,
				{
					from: ds.accounts[0],
					gas: 3000000
				}
			);
			this.setState({ stackId });
		} else {
			this.setState({ startTooltip: true });
			setTimeout(
				function() {
					this.setState({ startTooltip: false });
				}.bind(this),
				2000
			);
		}
	}

	handleTicketPurchase(type, index, event) {
		if (type === "amt") {
			let updated = this.state.ticketAmountInputs;
			updated[index] = event.target.value;
			this.setState({ ticketAmountInputs: updated });
		} else {
			let updated = this.state.passwords;
			updated[index] = event.target.value;
			this.setState({ passwords: updated });
		}
		console.log(this.state);
	}

	buyTickets(index, event) {
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		if (!this.saleActive()) {
			this.setState({ saleTimeoutTooltip: true });
			setTimeout(
				function() {
					this.setState({ saleTimeoutTooltip: false });
				}.bind(this),
				4000
			);
			return;
		}

		if (s.ticketAmountInputs[index] > 0 && s.passwords[index] && s.passwords[index].length > 0) {
			let convertedAmt = web3.utils.toWei(s.ticketAmountInputs[index]);
			const stackId = Lottery.methods["buyTicket"].cacheSend(web3.utils.sha3(s.passwords[index]), {
				from: ds.accounts[index],
				gas: 3000000,
				value: convertedAmt
			});
			this.setState({ stackId });
		} else {
			this.setState({ buyTooltip: true });
			setTimeout(
				function() {
					this.setState({ buyTooltip: false });
				}.bind(this),
				2000
			);
		}
	}

	getTxStatus = () => {
		const { transactions, transactionStack } = this.props.drizzleState;
		const txHash = transactionStack[this.state.stackId];

		if (!txHash) return null;
		return `Transaction status: ${transactions[txHash] && transactions[txHash].status}`;
	};

	renderManager() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;

		const active = Lottery._active[this.state.active];

		return (
			<div className='card manager' key={0}>
				<span>Manager</span>
				<div>
					{active && !active.value && (
						<div>
							<Tooltip
								title='Invalid inputs.'
								theme='light'
								inertia='true'
								position='bottom'
								open={this.state.startTooltip}
								trigger='manual'>
								<p />
							</Tooltip>

							<button onClick={e => this.startLottery(e)}>Start Lottery</button>
							<input
								type='number'
								placeholder='Ticket Price (ether)'
								min='0'
								onChange={e => this.handleOwnerChange("price", e)}
							/>
							<input
								type='number'
								placeholder='Sale Duration (minutes)'
								min='0'
								onChange={e => this.handleOwnerChange("sale", e)}
							/>
							<input
								type='number'
								placeholder='Lottery Duration (minutes)'
								min='0'
								onChange={e => this.handleOwnerChange("lottery", e)}
							/>
						</div>
					)}
					<br />
					Balance:{" "}
					{parseFloat(web3.utils.fromWei(ds.accountBalances[this.state.addresses[0]])).toFixed(3)}
					<span
						style={{
							fontSize: "12px"
						}}>
						{" "}
						ether
					</span>
				</div>
			</div>
		);
	}

	saleActive() {
		const { Lottery } = this.props.drizzleState.contracts;
		const lastActivated = Lottery._timeLastActivated[this.state.timeLastActivated];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];

		if (lastActivated && saleTimeout) {
			console.log(parseFloat(lastActivated.value), parseFloat(saleTimeout.value));
			if (Math.floor(new Date().getTime() / 1000) > saleTimeout.value) {
				return false;
			}
			return true;
		}
	}

	renderPlayers() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;
		const active = Lottery._active[this.state.active];

		const items = this.state.addresses.map(a => {
			let curIndex = this.state.addresses.indexOf(a);
			if (curIndex !== 0 && curIndex < this.state.users) {
				return (
					<div className='card' key={a}>
						<span> Account {curIndex} </span>
						<div>
							<div>
								<button onClick={e => this.buyTickets(curIndex, e)}>Buy Tickets</button>
								<input
									className='ticketInput'
									type='number'
									placeholder='(ether)'
									min='0'
									onChange={e => this.handleTicketPurchase("amt", curIndex, e)}
								/>
								<input
									type='password'
									placeholder='Password'
									onChange={e => this.handleTicketPurchase("pwd", curIndex, e)}
								/>
							</div>
							<br />
							Balance: {parseFloat(web3.utils.fromWei(ds.accountBalances[a])).toFixed(3)}
							<span
								style={{
									fontSize: "12px"
								}}>
								{" "}
								ether
							</span>
						</div>
					</div>
				);
			} else {
				return null;
			}
		});
		return items;
	}

	generateLotteryPool() {
		const { Lottery } = this.props.drizzleState.contracts;
		let ticketBalances = 0;

		for (let i = 0; i < this.state.users; i++) {
			const userBalance = Lottery._ticketBalances[this.state.ticketBalances[i]];
			if (userBalance && userBalance.value) {
				ticketBalances += parseFloat(userBalance.value);
			}
		}
		return ticketBalances;
	}

	renderControls() {
		const { Lottery } = this.props.drizzleState.contracts;
		const ticketPrice = Lottery._ticketPrice[this.state.ticketPrice];
		const ticketsIssued = Lottery._ticketsIssued[this.state.ticketsIssued];
		let web3 = this.props.drizzle.web3;

		if (ticketPrice && ticketPrice.value && ticketsIssued && ticketsIssued.value) {
			return (
				<div>
					<div className='card controls'>
						<p>
							Ticket Price: {web3.utils.fromWei(ticketPrice.value)}{" "}
							<span
								style={{
									fontSize: "12px"
								}}>
								ether
							</span>
						</p>
						<p> Tickets Issued: {ticketsIssued.value} </p>
						<p>
							Lottery Pool: {this.generateLotteryPool() * web3.utils.fromWei(ticketPrice.value)}{" "}
							<span
								style={{
									fontSize: "12px"
								}}>
								ether
							</span>
						</p>
					</div>
				</div>
			);
		} else {
			return (
				<div>
					<p> Loading... </p>
				</div>
			);
		}
	}

	render() {
		return (
			<div>
				<div className='controls-container'> {this.renderControls()} </div>
				<Tooltip
					title='Invalid ticket purchase inputs.'
					theme='light'
					inertia='true'
					position='top'
					open={this.state.buyTooltip}
					trigger='manual'>
					<p />
				</Tooltip>
				<Tooltip
					title='Ticket sales have ended. Please proceed to revealing secrets'
					theme='light'
					inertia='true'
					position='top'
					open={this.state.saleTimeoutTooltip}
					trigger='manual'>
					<p />
				</Tooltip>
				<div className='players-container'> {this.renderPlayers()} </div>
				<div className='manager-container'> {this.renderManager()} </div>
				<div>{this.getTxStatus()}</div>
			</div>
		);
	}
}

export default LotteryPlayers;
