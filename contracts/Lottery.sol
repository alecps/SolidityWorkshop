pragma solidity ^0.5.2;

contract Lottery {
  using SafeMath for uint256;

  mapping(address => bool) public _hasTicket;
  mapping(address => bytes32) public _commitments;
  mapping(address => bool) public _committed;
  mapping(address => uint256) public _secrets;
  mapping(address => bool) public _revealed;

  address[] private _candidates;

  uint256 public _ticketPrice;
  uint256
  uint256 public _timeout;

  constructor(uint256 ticketPrice, uint256 duration) {
    _ticketPrice = ticketPrice;
    _timeout = now + duration;
  }

  modifier expires() {
    require(now < _timeout);
    _;
  }

  function buyTicket() external payable expires() {
    require(!_hasTicket[msg.sender]);
    require(msg.value == ticketPrice);

    _tickets[msg.sender] = 1;
  }

  function commit(bytes32 hashedSecret) external expires() {
    require(_hasTicket[msg.sender]);
    require(!_committed[msg.sender]);

    _commitments[msg.sender] = hashedSecret;
    _committed[msg.sender] = true;
  }

  function reveal(uint256 secret) external expires() {
    require(_committed[msg.sender]);
    require(!_revealed[msg.sender]);

    require(_commitments[msg.sender] == keccack256(abi.encodedPacket(secret)));

    _secrets[msg.sender] = secret;
    _revealed[msg.sender] = true;
    _candidates = _candidates.push(msg.sender);
  }

  function findWinner() public {
    require(now > _timeout);
    //TODO
  }


}
