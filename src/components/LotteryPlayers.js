import React from 'react';
import 'react-tippy/dist/tippy.css';
import { Tooltip } from 'react-tippy';

import './../App.css';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000';

class LotteryPlayers extends React.Component {
	constructor(props) {
		super(props);
		const drizzleState = this.props.drizzleState;
		let addresses = Object.values(drizzleState.accounts);

		const contract = this.props.drizzle.contracts.Lottery;
		const activeKey = contract.methods['_active'].cacheCall();
		const timeLastActivatedKey = contract.methods['_timeLastActivated'].cacheCall();
		const saleTimeoutKey = contract.methods['_saleTimeout'].cacheCall();
		const revealTimeoutKey = contract.methods['_revealTimeout'].cacheCall();
		const ticketDataKey = contract.methods['_ticketPrice'].cacheCall();
		const issuedDataKey = contract.methods['_ticketsIssued'].cacheCall();

		const balanceDataKey = [];
		const commitmentDataKey = [];
		const revealedDataKey = [];
		for (let i = 0; i < addresses.length; i++) {
			balanceDataKey.push(contract.methods['_ticketBalances'].cacheCall(addresses[i]));
			commitmentDataKey.push(contract.methods['_commitments'].cacheCall(addresses[i]));
			revealedDataKey.push(contract.methods['_revealed'].cacheCall(addresses[i]));
		}

		this.state = {
			lotteryPool: 0,
			ticketPrice: ticketDataKey,
			ticketsIssued: issuedDataKey,
			users: Object.keys(drizzleState.accounts).length,
			addresses: addresses,
			ticketBalances: balanceDataKey,
			commitments: commitmentDataKey,
			revealed: revealedDataKey,
			active: activeKey,
			timeLastActivated: timeLastActivatedKey,
			saleTimeout: saleTimeoutKey,
			revealTimeout: revealTimeoutKey,
			ticketAmountInputs: [],
			passwords: []
		};
	}

	handleOwnerChange(type, event) {
		if (type === 'price') {
			this.setState({
				ticketPriceInput: event.target.value
			});
		} else if (type === 'sale') {
			this.setState({
				saleDurationInput: event.target.value
			});
		} else {
			this.setState({
				lotteryDurationInput: event.target.value
			});
		}
	}

	handleTicketPurchase(type, index, event) {
		if (type === 'amt') {
			let updated = this.state.ticketAmountInputs;
			updated[index] = event.target.value;
			this.setState({
				ticketAmountInputs: updated
			});
		} else {
			let updated = this.state.passwords;
			updated[index] = event.target.value;
			this.setState({
				passwords: updated
			});
		}
	}

	userPasswordSet(index) {
		const { Lottery } = this.props.drizzleState.contracts;
		const userCommited = Lottery._commitments[this.state.commitments[index]];
		return userCommited && userCommited.value !== ZERO_ADDRESS;
	}

	userRevealed(index) {
		const { Lottery } = this.props.drizzleState.contracts;
		const userRevealed = Lottery._revealed[this.state.revealed[index]];
		return userRevealed && userRevealed.value;
	}

	salePhase() {
		const { Lottery } = this.props.drizzleState.contracts;
		const lastActivated = Lottery._timeLastActivated[this.state.timeLastActivated];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];

		if (lastActivated && saleTimeout) {
			return !(Math.floor(new Date().getTime() / 1000) > saleTimeout.value);
		}
	}

	revealPhase() {
		const { Lottery } = this.props.drizzleState.contracts;
		const lastActivated = Lottery._timeLastActivated[this.state.timeLastActivated];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];
		const revealTimeout = Lottery._revealTimeout[this.state.revealTimeout];

		if (lastActivated && saleTimeout && revealTimeout) {
			let now = Math.floor(new Date().getTime() / 1000);
			return now > saleTimeout.value && now < revealTimeout.value;
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
			const stackId = Lottery.methods['activate'].cacheSend(
				convertedPrice,
				s.saleDurationInput * 60,
				s.lotteryDurationInput * 60,
				{
					from: ds.accounts[0],
					gas: 5000000
				}
			);
			this.setState({
				stackId
			});
		} else {
			console.log(s.ticketPriceInput);
			console.log(s.saleDurationInput);
			console.log(s.lotteryDurationInput);
			this.setState({
				startTooltip: true
			});
			setTimeout(
				function() {
					this.setState({
						startTooltip: false
					});
				}.bind(this),
				2000
			);
		}
	}

	buyTickets(index, event) {
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		const active = ds.contracts['Lottery']._active[this.state.active];
		if (active && !active.value) {
			this.setState({
				errorTooltip: true,
				errorTooltipContent:
					'Lottery is not active. If you are the manager, please start a new lottery.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				4000
			);
			return;
		}

		if (!this.salePhase()) {
			this.setState({
				errorTooltip: true,
				errorTooltipContent: 'Sales have ended.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				4000
			);
			return;
		}

		if (
			s.ticketAmountInputs[index] > 0 &&
			((s.passwords[index] && s.passwords[index].length > 0) || this.userPasswordSet(index))
		) {
			let convertedAmt = web3.utils.toWei(s.ticketAmountInputs[index]);
			let hashedSecret;

			if (s.passwords[index] && s.passwords[index].length > 0) {
				hashedSecret = web3.utils.soliditySha3(s.passwords[index]);
			} else {
				hashedSecret = web3.utils.soliditySha3(0);
			}

			const stackId = Lottery.methods['buyTicket'].cacheSend(hashedSecret, {
				from: ds.accounts[index],
				gas: 5000000,
				value: convertedAmt
			});
			let updated = this.state.passwords;
			updated[index] = '';
			this.setState({
				passwords: updated,
				stackId
			});
			if (!this.userPasswordSet(index)) {
				document.getElementById(index).value = '';
			}
		} else {
			this.setState({
				errorTooltip: true,
				errorTooltipContent:
					'Invalid inputs for purchasing tickets. Ether should be a positive number, and a password is required if you have not already set a password.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				2000
			);
		}
	}

	revealSecret(index, event) {
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		const active = ds.contracts['Lottery']._active[this.state.active];
		if (active && !active.value) {
			this.setState({
				errorTooltip: true,
				errorTooltipContent:
					'Lottery is not active. If you are the manager, please start a new lottery.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				4000
			);
			return;
		}

		if (!this.revealPhase()) {
			this.setState({
				errorTooltip: true,
				errorTooltipContent: 'Reveal phase has not started.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				4000
			);
			return;
		}

		if (s.passwords[index] && s.passwords[index].length > 0) {
			let revealedSecret = s.passwords[index];
			console.log(s.passwords[index]);

			const stackId = Lottery.methods['reveal'].cacheSend(revealedSecret, {
				from: ds.accounts[index],
				gas: 2000000
			});
			let updated = this.state.passwords;
			updated[index] = '';
			this.setState({
				passwords: updated,
				stackId
			});
			document.getElementById(index).value = '';
		} else {
			this.setState({
				errorTooltip: true,
				errorTooltipContent: 'A password is required to reveal your secret.'
			});
			setTimeout(
				function() {
					this.setState({
						errorTooltip: false
					});
				}.bind(this),
				2000
			);
		}
	}

	chooseWinner(index, event) {
		let ds = this.props.drizzleState;
		const { Lottery } = this.props.drizzle.contracts;

		const stackId = Lottery.methods['findWinner'].cacheSend({
			from: ds.accounts[index],
			gas: 2000000
		});
		this.setState({
			stackId
		});
	}

	getTxStatus = () => {
		const { transactions, transactionStack } = this.props.drizzleState;
		const txHash = transactionStack[this.state.stackId];

		if (!txHash) return null;
		if (transactions[txHash] && transactions[txHash].error) {
			return `Error: : ${transactions[txHash] && transactions[txHash].error['message']}`;
		} else {
			return `Transaction status: ${transactions[txHash] && transactions[txHash].status}`;
		}
	};

	renderManager() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;

		const active = Lottery._active[this.state.active];

		return (
			<div className="card manager" key={0}>
				<span> Manager </span>{' '}
				<div>
					{' '}
					{active && !active.value && (
						<div>
							<Tooltip
								title="Invalid inputs."
								theme="light"
								inertia="true"
								position="bottom"
								open={this.state.startTooltip}
								trigger="manual">
								<p />
							</Tooltip>{' '}
							<button onClick={e => this.startLottery(e)}> Start Lottery </button>{' '}
							<input
								type="number"
								placeholder="Ticket Price (ether)"
								min="0"
								onChange={e => this.handleOwnerChange('price', e)}
							/>{' '}
							<input
								type="number"
								placeholder="Sale Duration (minutes)"
								min="0"
								onChange={e => this.handleOwnerChange('sale', e)}
							/>{' '}
							<input
								type="number"
								placeholder="Lottery Duration (minutes)"
								min="0"
								onChange={e => this.handleOwnerChange('lottery', e)}
							/>{' '}
						</div>
					)}{' '}
					<br />
					Balance:{' '}
					{parseFloat(web3.utils.fromWei(ds.accountBalances[this.state.addresses[0]])).toFixed(
						3
					)}{' '}
					<span
						style={{
							fontSize: '12px'
						}}>
						ether{' '}
					</span>{' '}
				</div>{' '}
			</div>
		);
	}

	renderPlayers() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;
		const active = Lottery._active[this.state.active];

		const items = this.state.addresses.map(a => {
			let curIndex = this.state.addresses.indexOf(a);
			const userBalance = Lottery._ticketBalances[this.state.ticketBalances[curIndex]];

			if (curIndex !== 0 && curIndex < this.state.users) {
				return (
					<div className="card" key={a}>
						<div> Account {curIndex} </div>{' '}
						<div>
							<div>
								{' '}
								{this.salePhase() ? (
									<div>
										<button onClick={e => this.buyTickets(curIndex, e)}> Buy Tickets </button>{' '}
										<input
											className="ticketInput"
											type="number"
											placeholder="(ether)"
											min="0"
											onChange={e => this.handleTicketPurchase('amt', curIndex, e)}
										/>{' '}
									</div>
								) : (
									<div />
								)}{' '}
								{(this.salePhase() && !this.userPasswordSet(curIndex)) ||
								(this.revealPhase() && !this.userRevealed(curIndex)) ? (
									<input
										type="password"
										placeholder="Password"
										id={curIndex}
										onChange={e => this.handleTicketPurchase('pwd', curIndex, e)}
									/>
								) : (
									<div />
								)}{' '}
								{this.revealPhase() && !this.userRevealed(curIndex) ? (
									<button onClick={e => this.revealSecret(curIndex, e)}> Reveal Secret </button>
								) : (
									<div />
								)}{' '}
								{active && active.value && !this.revealPhase() && !this.salePhase() ? (
									<button onClick={e => this.chooseWinner(curIndex, e)}> Choose Winner </button>
								) : (
									<div />
								)}{' '}
							</div>{' '}
							<br />
							Balance: {parseFloat(web3.utils.fromWei(ds.accountBalances[a])).toFixed(3)}{' '}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether{' '}
							</span>{' '}
							{active && active.value ? (
								<div> Tickets Purchased: {userBalance ? userBalance.value : 0} </div>
							) : (
								<div />
							)}{' '}
							{active && active.value && this.revealPhase() ? (
								<div> {this.userRevealed(curIndex) ? 'Secret Revealed' : ''} </div>
							) : (
								<div />
							)}{' '}
						</div>{' '}
					</div>
				);
			} else {
				return null;
			}
		});
		return items;
	}

	renderControls() {
		const { Lottery } = this.props.drizzleState.contracts;
		const ticketPrice = Lottery._ticketPrice[this.state.ticketPrice];
		const ticketsIssued = Lottery._ticketsIssued[this.state.ticketsIssued];
		let web3 = this.props.drizzle.web3;
		const active = Lottery._active[this.state.active];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];
		const revealTimeout = Lottery._revealTimeout[this.state.revealTimeout];

		if (active && !active.value) {
			return <div />;
		}

		if (ticketPrice && ticketPrice.value && ticketsIssued && ticketsIssued.value) {
			return (
				<div>
					<div className="card controls">
						<p>
							Ticket Price: {web3.utils.fromWei(ticketPrice.value)}{' '}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether{' '}
							</span>{' '}
						</p>{' '}
						<p> Tickets Issued: {ticketsIssued.value} </p>{' '}
						<p>
							Lottery Pool: {ticketsIssued.value * web3.utils.fromWei(ticketPrice.value)}{' '}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether{' '}
							</span>{' '}
						</p>{' '}
						<p>
							<b> Lottery State </b> <br />{' '}
							{this.salePhase() && saleTimeout ? (
								<span>
									Sale Phase <br /> Ends:{' '}
									{new Date(parseFloat(saleTimeout.value) * 1000).toString()}{' '}
								</span>
							) : (
								<span>
									{' '}
									{this.revealPhase() && revealTimeout ? (
										<span>
											Reveal Phase <br />
											Ends: {new Date(parseFloat(revealTimeout.value) * 1000).toString()}{' '}
										</span>
									) : (
										'Lottery ended. Select winner.'
									)}{' '}
								</span>
							)}{' '}
						</p>{' '}
					</div>{' '}
				</div>
			);
		} else {
			return (
				<div>
					<p> Loading... </p>{' '}
				</div>
			);
		}
	}

	render() {
		return (
			<div>
				<div className="controls-container"> {this.renderControls()} </div>{' '}
				<Tooltip
					theme="light"
					inertia="true"
					sticky="true"
					html={this.state.errorTooltipContent}
					position="top"
					open={this.state.errorTooltip}
					trigger="manual">
					<p />
				</Tooltip>{' '}
				<div> {this.getTxStatus()} </div>{' '}
				<div className="players-container"> {this.renderPlayers()} </div>{' '}
				<div className="manager-container"> {this.renderManager()} </div>{' '}
			</div>
		);
	}
}

export default LotteryPlayers;
