pragma solidity ^0.5.2;

contract Lottery {
  using SafeMath for uint256;

  mapping(address => uint256) public _ticketBalances;
  mapping(address => bytes32) public _commitments;
  mapping(address => bool) public _revealed;
  uint256[] public _secrets;

  address[] public _candidates;

  uint256 public _ticketPrice;
  uint256 public _ticketsIssued;

  uint256 public _saleTimeout;
  uint256 public _lotteryTimeout;

  constructor( // TODO: check formatting.
    uint256 ticketPrice,
    uint256 saleDuration,
    uint256 lotteryDuration
  ) {
    require(ticketPrice > 0);
    require(saleDuration > 0); // TODO: Make this stricter?
    require(lotteryDuration > saleDuration); // TODO: Add a delta here? difference in prev blocktimes?

    _ticketPrice = ticketPrice;
    _saleTimeout = now + saleDuration; // TODO: Should we use block number instead ??
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
    require(msg.value >= ticketPrice);

    // hashedSecret only committed on first ticket purchase.
    if (_ticketBalances[msg.sender] == 0) {
      _commitments[msg.sender] = hashedSecret;
    }

    uint256 numPurchased = msg.value.div(ticketPrice);
    uint256 spentWei = numPurchased.mul(ticketPrice);
    if (msg.value > spentWei) { // Return any unused wei.
      msg.sender.transfer(msg.value.sub(spentWei));
    }

    _ticketBalances[msg.sender] = _ticketBalances[msg.sender].add(numPurchased);
    _ticketsIssued = _ticketsIssued.add(numPurchased);
  }

  function reveal(uint256 secret) external revealPhase() {
    require(_ticketBalances[msg.sender] > 0);
    require(!_revealed[msg.sender]);

    require(_commitments[msg.sender] == keccack256(abi.encodedPacket(secret)));

    _secrets = _secrets.push(secret);
    _revealed[msg.sender] = true;
    for (uint256 i = 0; i < _ticketBalances[msg.sender]; i++) {
      _candidates = _candidates.push(msg.sender); // TODO: Better to be spread out (not contiguous)?
    }
  }

  function findWinner() public payoutPhase() {
    uint256[] memory secrets = _secrets; // TODO: Does this work??

    uint256 xor = 0;
    for(uint256 i = 0; i < secrets.length; i++) {
      xor = xor ^ secrets[i];
    }

    address winner = _candidates[xor.mod(secrets.length)];
    winner.transfer(this.balance);
    // TODO: self destruct?
  }

}
