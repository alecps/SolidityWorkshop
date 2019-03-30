import React from "react";

import "./../App.css";

class LotteryPlayers extends React.Component {
	constructor(props) {
		super(props);
		this.state = {};
		console.log(this.props.drizzle);
		console.log(this.props.drizzleState);
	}

	renderUsers() {
		let ds = this.props.drizzleState;
		let web3 = this.props.drizzle.web3;

		const items = Object.keys(ds.accounts).map(a => {
			return (
				<div className='card' key={ds.accounts[a]}>
					<div>{a}</div>
					<div>
						<br />
						Balance: {web3.utils.fromWei(ds.accountBalances[ds.accounts[a]])}
						<span style={{ fontSize: "12px" }}> ether</span>
					</div>
				</div>
			);
		});
		return items;
	}

	render() {
		return <div className='players-container'>{this.renderUsers()}</div>;
	}
}

export default LotteryPlayers;
