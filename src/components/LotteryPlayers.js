import React from 'react';
import 'react-tippy/dist/tippy.css';
import { Tooltip } from 'react-tippy';

/**
 * Import relevant components/styling
 */
import './../App.css';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000000';
// Zero address constant

/**
 * JSX Class for Lottery Players
 */
class LotteryPlayers extends React.Component {
	constructor(props) {
		super(props);

		/**
		 * Get reference to the drizzleState from the props and set the eth addresses to those
		 * from the drizzelState's accounts list.
		 */
		const drizzleState = this.props.drizzleState;
		let addresses = Object.values(drizzleState.accounts);
		// Set up reference to the Lottery contract
		const contract = this.props.drizzle.contracts.Lottery;

		/**
		 * Set up data keys usign cacheCall() for the relevant Lottery contract methods
		 */
		const activeKey = contract.methods['_active'].cacheCall();
		const timeLastActivatedKey = contract.methods['_timeLastActivated'].cacheCall();
		const saleTimeoutKey = contract.methods['_saleTimeout'].cacheCall();
		const revealTimeoutKey = contract.methods['_revealTimeout'].cacheCall();
		const ticketDataKey = contract.methods['_ticketPrice'].cacheCall();
		const issuedDataKey = contract.methods['_ticketsIssued'].cacheCall();

		/**
		 * Sets up an array for the datakeys that represent Solidity mappings. The datakey at
		 * a given index is used to get the information from the mapping of the given address.
		 */
		const balanceDataKey = [];
		const commitmentDataKey = [];
		const revealedDataKey = [];
		for (let i = 0; i < addresses.length; i++) {
			balanceDataKey.push(contract.methods['_ticketBalances'].cacheCall(addresses[i]));
			commitmentDataKey.push(contract.methods['_commitments'].cacheCall(addresses[i]));
			revealedDataKey.push(contract.methods['_revealed'].cacheCall(addresses[i]));
		}

		/**
		 * Set the React state with base properties.
		 */
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

	/**
	 * Event handler for when manager input fields change.
	 *
	 * @param {*} type
	 * @param {*} event
	 */
	handleOwnerChange(type, event) {
		/**
		 * Update the corresponding state based on which input field
		 * has changed.
		 */
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

	/**
	 * Event handler for when the ticket purchasing fields are changed.
	 *
	 * @param {*} type
	 * @param {*} event
	 */
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

	/**
	 * Determines whether a given player's password has already been set.
	 * @param {*} index
	 */
	userPasswordSet(index) {
		const { Lottery } = this.props.drizzleState.contracts;
		const userCommited = Lottery._commitments[this.state.commitments[index]];
		return userCommited && userCommited.value !== ZERO_ADDRESS;
	}

	/**
	 * Determines whether a given player has already revealed their secret.
	 * @param {*} index
	 */
	userRevealed(index) {
		const { Lottery } = this.props.drizzleState.contracts;
		const userRevealed = Lottery._revealed[this.state.revealed[index]];
		return userRevealed && userRevealed.value;
	}

	/**
	 * Determines whether the lottery is currently in the sale phase.
	 */
	salePhase() {
		const { Lottery } = this.props.drizzleState.contracts;
		const lastActivated = Lottery._timeLastActivated[this.state.timeLastActivated];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];

		if (lastActivated && saleTimeout) {
			return !(Math.floor(new Date().getTime() / 1000) > saleTimeout.value);
		}
	}

	/**
	 * Determines whether the lottery is currently in the reveal phase.
	 */
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

	/**
	 * Starts the lottery if the givne parameters are valid.
	 */
	startLottery() {
		/**
		 * Set up references to the drizzleState and Lottery contract for
		 * ease of use.
		 */
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		/**
		 * Checks if the ticket price, saleDuration are greater than 0 and
		 * the lotteryDuration is greater than saleDuration
		 */
		if (
			s.ticketPriceInput > 0 &&
			s.saleDurationInput > 0 &&
			s.lotteryDurationInput > s.saleDurationInput
		) {
			// Converts the amount from Ether to Wei
			let convertedPrice = web3.utils.toWei(s.ticketPriceInput);

			// Creates and sends the tx from the manager account (accounts[0])
			const stackId = Lottery.methods['activate'].cacheSend(
				convertedPrice,
				// Durations are measured in minutes, while Solidity requires seconds
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
			/**
			 * Protocol for when invalid arguments.
			 * Show the proper validation tooltips to prompt input re-entry.
			 */
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

	/**
	 * Function that handles buying ticket requests.
	 *
	 * @param {*} index
	 * @param {*} event
	 */
	buyTickets(index, event) {
		/**
		 * Set up references to the drizzleState, web3 instance,
		 * and Lottery contract for ease of use.
		 */
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		// Checks if the Lottery state is active
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

		// Checks if currently in sale phase.
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

		/**
		 * Checks if the amount of tickets entered is positive and, if the user has not set a
		 * password already, that the length of the password entered is greater than 0.
		 */
		if (
			s.ticketAmountInputs[index] > 0 &&
			((s.passwords[index] && s.passwords[index].length > 0) || this.userPasswordSet(index))
		) {
			// Converts ticket amount from Ether to Wei
			let convertedAmt = web3.utils.toWei(s.ticketAmountInputs[index]);
			let hashedSecret;

			// If password is entered, hash the password using the soliditySha3 function
			if (s.passwords[index] && s.passwords[index].length > 0) {
				hashedSecret = web3.utils.soliditySha3(s.passwords[index]);
			} else {
				hashedSecret = web3.utils.soliditySha3(0);
			}

			// Creates and sends the buyTicket tx from the account of the specified user
			const stackId = Lottery.methods['buyTicket'].cacheSend(hashedSecret, {
				from: ds.accounts[index],
				gas: 5000000,
				value: convertedAmt
			});

			// Resets the password after submitting
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
			// Invalid inputs. Show tooltips and prompt for re-entry.
			this.setState({
				errorTooltip: true,
				errorTooltipContent: `Invalid inputs for purchasing tickets.
				Ether should be a positive number, and a password is required if you have
				not already set a password.`
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

	/**
	 * Function that handles revealing secret requests.
	 *
	 * @param {*} index
	 * @param {*} event
	 */
	revealSecret(index, event) {
		/**
		 * Set up references to the drizzleState, web3 instance,
		 * and Lottery contract for ease of use.
		 */
		let s = this.state;
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzle.contracts;

		// Checks if the Lottery state is active
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

		// Checks if currently in reveal phase
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

		// Checks if the password inputted has length greater than 0.
		if (s.passwords[index] && s.passwords[index].length > 0) {
			let revealedSecret = s.passwords[index];
			// Create and send reveal function tx from specified user account.
			const stackId = Lottery.methods['reveal'].cacheSend(revealedSecret, {
				from: ds.accounts[index],
				gas: 2000000
			});

			// Reset the password after submitting.
			let updated = this.state.passwords;
			updated[index] = '';
			this.setState({
				passwords: updated,
				stackId
			});
			document.getElementById(index).value = '';
		} else {
			// No password entered. Show validation tooltips to prompt re-entry.
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

	/**
	 * Function that handles choosing lottery winner requests.
	 *
	 * @param {*} index
	 * @param {*} event
	 */
	chooseWinner(index, event) {
		// Set up references to drizzleState and Lottery contract
		let ds = this.props.drizzleState;
		const { Lottery } = this.props.drizzle.contracts;

		// Create and send findWinner function tx from the specified user account.
		const stackId = Lottery.methods['findWinner'].cacheSend({
			from: ds.accounts[index],
			gas: 2000000
		});
		this.setState({
			stackId
		});
	}

	/**
	 * Helper function that get the current tx status and updates the page with
	 * the current status of a given transaction.
	 */
	getTxStatus = () => {
		const { transactions, transactionStack } = this.props.drizzleState;
		const txHash = transactionStack[this.state.stackId];

		// If there's an error in the transaction, display the error message
		if (!txHash) return null;
		if (transactions[txHash] && transactions[txHash].error) {
			return `Error: : ${transactions[txHash] && transactions[txHash].error['message']}`;
		} else {
			// Otherwise, report transaction status.
			return `Transaction status: ${transactions[txHash] && transactions[txHash].status}`;
		}
	};

	/**
	 * Renders the manager card on the page.
	 */
	renderManager() {
		/**
		 * Set up references to the drizzleState, web3 instance,
		 * and Lottery contract for ease of use.
		 */
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;

		// Whether the lottery is currently active for use in conditional rendering
		const active = Lottery._active[this.state.active];
		return (
			<div className="card manager" key={0}>
				<span> Manager </span>
				<div>
					{/* If the lottery is not active, then display form elements for
					starting a new Lottery. */}
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
							</Tooltip>
							<button onClick={e => this.startLottery(e)}> Start Lottery </button>
							<input
								type="number"
								placeholder="Ticket Price (ether)"
								min="0"
								onChange={e => this.handleOwnerChange('price', e)}
							/>
							<input
								type="number"
								placeholder="Sale Duration (minutes)"
								min="0"
								onChange={e => this.handleOwnerChange('sale', e)}
							/>
							<input
								type="number"
								placeholder="Lottery Duration (minutes)"
								min="0"
								onChange={e => this.handleOwnerChange('lottery', e)}
							/>
						</div>
					)}
					<br />
					{/* Shows the manager's account balance. */}
					Balance:
					{parseFloat(web3.utils.fromWei(ds.accountBalances[this.state.addresses[0]])).toFixed(3)}
					<span
						style={{
							fontSize: '12px'
						}}>
						ether
					</span>
				</div>
			</div>
		);
	}

	/**
	 * Renders the Lottery players on the page.
	 */
	renderPlayers() {
		/**
		 * Set up references to the drizzleState, web3 instance,
		 * and Lottery contract for ease of use.
		 */
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;
		const { Lottery } = this.props.drizzleState.contracts;

		// Whether the lottery is currently active for use in conditional rendering
		const active = Lottery._active[this.state.active];

		// Map over every address stored in the React state and return a new card for the user.
		const items = this.state.addresses.map(a => {
			/**
			 * Get the index of the current address for use in Solidity mapping queries and
			 * the number of tickets the user has purchased
			 */
			let curIndex = this.state.addresses.indexOf(a);
			const userBalance = Lottery._ticketBalances[this.state.ticketBalances[curIndex]];

			// Only render if not the manager.
			if (curIndex !== 0 && curIndex < this.state.users) {
				return (
					<div className="card" key={a}>
						<div> Account {curIndex} </div>
						<div>
							<div>
								{/* If currently in the sale phase, render the button for
								buying tickets) */}
								{this.salePhase() ? (
									<div>
										<button onClick={e => this.buyTickets(curIndex, e)}> Buy Tickets </button>
										<input
											className="ticketInput"
											type="number"
											placeholder="(ether)"
											min="0"
											onChange={e => this.handleTicketPurchase('amt', curIndex, e)}
										/>
									</div>
								) : (
									<div />
								)}

								{/* If in the sale phase and the user has not set password OR
								in the reveal phase and the user has not revealed password, render the
								input form for entering a password. */}
								{(this.salePhase() && !this.userPasswordSet(curIndex)) ||
								(this.revealPhase() && !this.userRevealed(curIndex)) ? (
									<input
										type="password"
										placeholder="Password"
										pattern="[0-9]"
										id={curIndex}
										onChange={e => this.handleTicketPurchase('pwd', curIndex, e)}
									/>
								) : (
									<div />
								)}

								{/* If in the reveal phase and user has not revealed their secret, render
								the button for revealing a secret. */}
								{this.revealPhase() && !this.userRevealed(curIndex) ? (
									<button onClick={e => this.revealSecret(curIndex, e)}> Reveal Secret </button>
								) : (
									<div />
								)}

								{/* If lottery is active and not in either reveal or sale phases,
								render the button for choosing a Lottery winner. */}
								{active && active.value && !this.revealPhase() && !this.salePhase() ? (
									<button onClick={e => this.chooseWinner(curIndex, e)}> Choose Winner </button>
								) : (
									<div />
								)}
							</div>
							<br />
							{/* Render the balance of the given user. */}
							Balance: {parseFloat(web3.utils.fromWei(ds.accountBalances[a])).toFixed(3)}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether
							</span>
							{/* If the Lottery is active, render the number of tickets
							the user has purchased. */}
							{active && active.value ? (
								<div> Tickets Purchased: {userBalance ? userBalance.value : 0} </div>
							) : (
								<div />
							)}
							{/* If the Lottery is active and in the reveal phase, render
							whether the user has revealed their secret. */}
							{active && active.value && this.revealPhase() ? (
								<div> {this.userRevealed(curIndex) ? 'Secret Revealed' : ''} </div>
							) : (
								<div />
							)}
						</div>
					</div>
				);
			} else {
				return null;
			}
		});
		return items;
	}

	/**
	 * Renders the controls on the page
	 */
	renderControls() {
		/**
		 * Set up references to the web3 instance
		 * and Lottery contract for ease of use.
		 */
		const { Lottery } = this.props.drizzleState.contracts;
		let web3 = this.props.drizzle.web3;

		/**
		 * Constants for ticket price, number of tickets issued, Lottery active
		 * state, saleTimeout and revealTimeour.
		 */
		const ticketPrice = Lottery._ticketPrice[this.state.ticketPrice];
		const ticketsIssued = Lottery._ticketsIssued[this.state.ticketsIssued];
		const active = Lottery._active[this.state.active];
		const saleTimeout = Lottery._saleTimeout[this.state.saleTimeout];
		const revealTimeout = Lottery._revealTimeout[this.state.revealTimeout];

		// Render nothing if Lottery is not active.
		if (active && !active.value) {
			return <div />;
		}

		/**
		 * Wait until ticketPrice and ticketsIssued are not undefined.
		 */
		if (ticketPrice && ticketPrice.value && ticketsIssued && ticketsIssued.value) {
			return (
				<div>
					<div className="card controls">
						<p>
							Ticket Price: {web3.utils.fromWei(ticketPrice.value)}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether
							</span>
						</p>
						<p> Tickets Issued: {ticketsIssued.value} </p>
						<p>
							Lottery Pool: {ticketsIssued.value * web3.utils.fromWei(ticketPrice.value)}
							<span
								style={{
									fontSize: '12px'
								}}>
								ether
							</span>
						</p>
						<p>
							{/* Conditional rendering for the current phase and when each phase ends.
							For all timeouts, create a new JS Date object with the timeout value (UNIX time)
							and multiple by 1000 to convert to milliseconds. */}
							<b> Lottery Phase </b> <br />
							{/* If in the salePhase */}
							{this.salePhase() && saleTimeout ? (
								<span>
									Sale Phase <br /> Ends:
									{new Date(parseFloat(saleTimeout.value) * 1000).toString()}
								</span>
							) : (
								<span>
									{/* If in the salePhase */}
									{this.revealPhase() && revealTimeout ? (
										<span>
											Reveal Phase <br />
											Ends: {new Date(parseFloat(revealTimeout.value) * 1000).toString()}
										</span>
									) : (
										'Lottery ended. Select winner.'
									)}
								</span>
							)}
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
				<div className="controls-container"> {this.renderControls()} </div>
				<Tooltip
					theme="light"
					inertia="true"
					sticky="true"
					html={this.state.errorTooltipContent}
					position="top"
					open={this.state.errorTooltip}
					trigger="manual">
					<p />
				</Tooltip>
				<div> {this.getTxStatus()} </div>
				<div className="players-container"> {this.renderPlayers()} </div>
				<div className="manager-container"> {this.renderManager()} </div>
			</div>
		);
	}
}

export default LotteryPlayers;
