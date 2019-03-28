pragma solidity ^0.5.2;
import "./SafeMath.sol";

contract Lottery {
  using SafeMath for uint256;

  event LotteryWon(address winner, uint256 prize, uint256 ticketsIssued);

  mapping(address => uint256) public _ticketBalances;
  mapping(address => bytes32) public _commitments;
  mapping(address => bool) public _revealed;
  uint256 private _xor;
  address[] public _candidates;

  uint256 public _ticketPrice;
  uint256 public _ticketsIssued;

  uint256 public _saleTimeout;
  uint256 public _lotteryTimeout;

  constructor (
    uint256 ticketPrice,
    uint256 saleDuration,
    uint256 lotteryDuration
  ) public {
    require(ticketPrice > 0);
    require(saleDuration > 0); // Should make this stricter, but we'll keep it as is for the purposes of the workshop.
    require(lotteryDuration >= saleDuration.mul(2)); // Reveal phase must be at least as long as sale phase.

    _ticketPrice = ticketPrice;
    _saleTimeout = now + saleDuration;
    _lotteryTimeout = now + lotteryDuration;
  }

  modifier salePhase() {
    require(now < _saleTimeout);
    _;
  }
  modifier revealPhase() {
    require(now > _saleTimeout && now < _lotteryTimeout);
    _;
  }
  modifier payoutPhase() {
    require(now > _lotteryTimeout);
    _;
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
    emit LotteryWon(winner, address(this).balance, _ticketsIssued);
    selfdestruct(winner); // Destroys this contract and sends balance to winner.
  }

}
