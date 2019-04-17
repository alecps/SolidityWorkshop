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

  address payable public _owner;

  uint256 public _lotteryID;
  bool public _active;
  uint256 public _timeLastActivated;

  mapping(bytes32 => uint256) public _ticketBalances;
  mapping(bytes32 => bytes32) public _commitments;
  mapping(bytes32 => bool) public _revealed;
  uint256 private _xor;

  address[] public _candidates;

  uint256 public _ticketsIssued;

  uint256 public _ticketPrice;
  uint256 public _commissionRate;
  uint256 public _saleTimeout;
  uint256 public _revealTimeout;

  constructor() public {
    _owner = msg.sender;
    _lotteryID = 1; // Lotteries are indexed starting at 1.
  }

  modifier onlyOwner() {
    require(msg.sender == _owner);
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
  modifier salePhase() {
    require(_active);
    require(now < _saleTimeout);
    _;
  }
  modifier revealPhase() {
    require(_active);
    require(now > _saleTimeout && now < _revealTimeout);
    _;
  }
  modifier payoutPhase() {
    require(_active);
    require(now > _revealTimeout);
    _;
  }

  function activate(
    uint256 ticketPrice,
    uint256 commissionRate,
    uint256 salePhaseDuration,
    uint256 revealPhaseDuration
  ) external inactive() onlyOwner() {
    require(ticketPrice > 0);
    require(salePhaseDuration > 0);
    require(revealPhaseDuration >= salePhaseDuration); // Reveal phase must be at least as long as sale phase.

    _ticketPrice = ticketPrice;
    _commissionRate = commissionRate;
    uint256 saleTimeout = now.add(salePhaseDuration);
    uint256 revealTimeout = saleTimeout.add(revealPhaseDuration);
    _saleTimeout = saleTimeout;
    _revealTimeout = revealTimeout;
    _timeLastActivated = now;
    _active = true;
    emit LotteryActivated(_lotteryID, ticketPrice, saleTimeout, revealTimeout);
  }

  function buyTicket(bytes32 hashedSecret) external payable salePhase() {
    require(msg.value >= _ticketPrice);

    bytes32 key = getKey(msg.sender);

    uint256 ticketBalance = _ticketBalances[key]; // Gas optimization.

    // hashedSecret only committed on first ticket purchase.
    if (ticketBalance == 0) {
      _commitments[key] = hashedSecret;
    }

    uint256 numPurchased = msg.value.div(_ticketPrice);
    uint256 spentWei = numPurchased.mul(_ticketPrice);
    if (msg.value > spentWei) { // Return any unused wei.
      msg.sender.transfer(msg.value.sub(spentWei));
    }

    _ticketBalances[key] = ticketBalance.add(numPurchased);
    _ticketsIssued = _ticketsIssued.add(numPurchased);
  }

  function reveal(uint256 secret) external revealPhase() {
    bytes32 key = getKey(msg.sender);
    require(!_revealed[key]);
    uint256 ticketBalance = _ticketBalances[key]; // Gas optimization.
    require(ticketBalance > 0);

    // Verify secret.
    require(_commitments[key] == keccak256(abi.encodePacked(secret)));

    _xor = _xor ^ secret;
    _revealed[key] = true;
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
    uint256 commission = address(this).balance.div(_commissionRate);
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

    // Delete state variables.
    delete(_ticketPrice);
    delete(_commissionRate);
    delete(_ticketsIssued);
    delete(_saleTimeout);
    delete(_revealTimeout);
    delete(_xor);

    // Delete candidates array.
    _candidates.length = 0;

    // Delete mappings.
    _lotteryID++;

    // Make inactive.
    _active = false;
  }


  function recoverGas(uint256 lotteryID, address ticketHolder) external {
    require(lotteryID < _lotteryID && lotteryID > 0);
    bytes32 key = keccak256(abi.encodePacked(lotteryID, ticketHolder));
    delete(_ticketBalances[key]);
    delete(_commitments[key]);
    delete(_revealed[key]);
  }

  function getKey(address a) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(a, _lotteryID));
  }

}
