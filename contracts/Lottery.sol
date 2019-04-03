pragma solidity ^0.5.2;

import "./SafeMath.sol";

contract Lottery {
  using SafeMath for uint256;

  event LotteryActivated(
    uint256 lotteryID,
    uint256 ticketPrice,
    uint256 saleTimeout,
    uint256 revealTimeout
  );
  event LotteryWon(
    uint256 lotteryID,
    address winner,
    uint256 prize,
    uint256 commission,
    uint256 ticketsIssued,
    uint256 numCandidates,
    uint256 duration
  );

  address payable public _owner; //TODO: inherit from ownable.sol?

  uint256 public _lotteryID;
  bool public _active;
  uint256 public _timeLastActivated;

  mapping(address => uint256) public _ticketBalances;
  mapping(address => bytes32) public _commitments;
  mapping(address => bool) public _revealed;
  uint256 private _xor;

  address[] public _ticketHolders;
  address[] public _candidates;

  uint256 public _ticketPrice;
  uint256 public _ticketsIssued;

  uint256 public _saleTimeout;
  uint256 public _revealTimeout;

  constructor() public {
    _owner = msg.sender;
  }

  modifier salePhase() {
    require(now < _saleTimeout);
    _;
  }
  modifier revealPhase() {
    require(now > _saleTimeout && now < _revealTimeout);
    _;
  }
  modifier payoutPhase() {
    require(now > _revealTimeout);
    _;
  }
  modifier inactive() {
    require(!_active);
    _;
  }
  modifier active() {
    require(_active);
    _;
  }
  modifier onlyOwner() {
    require(msg.sender == _owner);
    _;
  }

  function activate(
    uint256 ticketPrice,
    uint256 salePhaseDuration,
    uint256 revealPhaseDuration
  ) external inactive() onlyOwner() {
    require(ticketPrice > 0);
    require(salePhaseDuration > 0); // Should make this stricter, but we'll keep it as is for the purposes of the workshop.
    require(revealPhaseDuration >= salePhaseDuration); // Reveal phase must be at least as long as sale phase.

    _lotteryID++;
    _ticketPrice = ticketPrice;
    uint256 saleTimeout = now.add(salePhaseDuration); // TODO: Is this actually a gas optimization??
    uint256 revealTimeout = saleTimeout.add(revealPhaseDuration);
    _saleTimeout = saleTimeout;
    _revealTimeout = revealTimeout;
    _timeLastActivated = now;
    _active = true;
    emit LotteryActivated(_lotteryID, ticketPrice, saleTimeout, revealTimeout);
  }

  function buyTicket(bytes32 hashedSecret) external payable salePhase() {
    require(msg.value >= _ticketPrice);

    uint256 ticketBalance = _ticketBalances[msg.sender]; // Gas optimization.

    // hashedSecret only committed on first ticket purchase.
    if (ticketBalance == 0) {
      _commitments[msg.sender] = hashedSecret;
    }

    uint256 numPurchased = msg.value.div(_ticketPrice);
    uint256 spentWei = numPurchased.mul(_ticketPrice);
    if (msg.value > spentWei) { // Return any unused wei.
      msg.sender.transfer(msg.value.sub(spentWei));
    }

    _ticketBalances[msg.sender] = ticketBalance.add(numPurchased);
    _ticketsIssued = _ticketsIssued.add(numPurchased);
  }

  function reveal(uint256 secret) external revealPhase() {
    require(!_revealed[msg.sender]);
    uint256 ticketBalance = _ticketBalances[msg.sender]; // Gas optimization.
    require(ticketBalance > 0);

    // Verify secret.
    require(_commitments[msg.sender] == keccak256(abi.encodePacked(secret)));

    _xor = _xor ^ secret;
    _revealed[msg.sender] = true;
    for (uint256 i = 0; i < ticketBalance; i++) { // Ticket price will have to be high enough to protect this loop.
      _candidates.push(msg.sender);
    }
  }

  function findWinner() public payoutPhase() {
    uint256 numCandidates = _candidates.length; // Gas optimization.
    require(numCandidates > 0);

    uint256 winningIndex = uint256(
      keccak256(abi.encodePacked(_xor, blockhash(block.number-1)))
    ).mod(numCandidates);

    address payable winner = address(uint160(_candidates[winningIndex]));
    uint256 commission = address(this).balance.div(10); // Owner takes 10%
    _owner.transfer(commission);
    uint256 prize = address(this).balance;
    winner.transfer(prize);

    emit LotteryWon(
      _lotteryID,
      winner,
      prize,
      commission,
      _ticketsIssued,
      numCandidates,
      now - _timeLastActivated
    );

    deactivate();
  }

  function deactivate() internal active() {
    require(address(this).balance == 0);

    delete(_ticketPrice);
    delete(_ticketsIssued);
    delete(_saleTimeout);
    delete(_revealTimeout);
    delete(_xor);

    uint256 numTicketHolders = _ticketHolders.length;
    for(uint256 i = 0; i < numTicketHolders; i++) {
      address ticketHolder = _ticketHolders[i];
      delete(_ticketHolders[i]);
      delete(_ticketBalances[ticketHolder]);
      delete(_commitments[ticketHolder]);
    }
    _ticketHolders.length = 0;

    uint256 numCandidates = _candidates.length;
    for(uint256 n = 0; n < numCandidates; n++) {
      address candidate = _candidates[n];
      delete(_candidates[n]);
      delete(_revealed[candidate]);
    }
    _candidates.length = 0;

    _active = false;

    //TODO : Should we do this using lotteryID? The above method may cost too much gas.

  }

}
