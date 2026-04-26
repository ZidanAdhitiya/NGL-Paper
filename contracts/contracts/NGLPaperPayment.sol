// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NGLPaperPayment
 * @notice Payment contract for NGL Paper — AI whitepaper explanation on Celo
 * @dev Accepts CELO (native) and cUSD (ERC-20) payments per page of document.
 *      Deployed on Celo Mainnet for the MiniPay mini-apps competition.
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract NGLPaperPayment {
    /* ── State ────────────────────────────────────────────── */
    address public owner;
    IERC20  public cUSD;

    uint256 public pricePerPageCELO;  // in CELO wei  (e.g. 22000000000000000 = 0.022 CELO)
    uint256 public pricePerPageCUSD;  // in cUSD wei  (e.g. 10000000000000000 = 0.01 cUSD)

    uint256 public totalExplains;     // total number of explain requests paid

    /* ── Events ───────────────────────────────────────────── */
    event PaperExplained(
        address indexed payer,
        uint256         pages,
        string          token,   // "CELO" | "cUSD"
        uint256         amount   // amount paid in token wei
    );

    event PricesUpdated(uint256 newCELO, uint256 newCUSD);
    event Withdrawal(address indexed to, uint256 amount, string token);
    event OwnershipTransferred(address indexed previous, address indexed next);

    /* ── Modifiers ────────────────────────────────────────── */
    modifier onlyOwner() {
        require(msg.sender == owner, "NGLPaper: not owner");
        _;
    }

    /* ── Constructor ──────────────────────────────────────── */
    /**
     * @param _cUSD              cUSD token address (chain-specific)
     * @param _pricePerPageCELO  Price per page in CELO wei
     * @param _pricePerPageCUSD  Price per page in cUSD wei
     */
    constructor(
        address _cUSD,
        uint256 _pricePerPageCELO,
        uint256 _pricePerPageCUSD
    ) {
        require(_cUSD != address(0), "NGLPaper: zero cUSD address");
        owner            = msg.sender;
        cUSD             = IERC20(_cUSD);
        pricePerPageCELO = _pricePerPageCELO;
        pricePerPageCUSD = _pricePerPageCUSD;
    }

    /* ── Payment: native CELO ─────────────────────────────── */
    /**
     * @notice Pay with native CELO to explain `pages` pages.
     * @param pages Number of pages in the document (must match backend count).
     */
    function explainWithCELO(uint256 pages) external payable {
        require(pages > 0, "NGLPaper: pages must be > 0");
        uint256 required = pricePerPageCELO * pages;
        require(msg.value >= required, "NGLPaper: insufficient CELO");

        // Refund any excess sent
        uint256 excess = msg.value - required;
        if (excess > 0) {
            (bool ok,) = payable(msg.sender).call{value: excess}("");
            require(ok, "NGLPaper: refund failed");
        }

        totalExplains++;
        emit PaperExplained(msg.sender, pages, "CELO", required);
    }

    /* ── Payment: cUSD (ERC-20) ───────────────────────────── */
    /**
     * @notice Pay with cUSD to explain `pages` pages.
     *         Caller must first approve this contract to spend cUSD.
     * @param pages Number of pages in the document.
     */
    function explainWithCUSD(uint256 pages) external {
        require(pages > 0, "NGLPaper: pages must be > 0");
        uint256 amount = pricePerPageCUSD * pages;
        require(
            cUSD.transferFrom(msg.sender, address(this), amount),
            "NGLPaper: cUSD transfer failed - approve first"
        );

        totalExplains++;
        emit PaperExplained(msg.sender, pages, "cUSD", amount);
    }

    /* ── Owner: withdraw CELO ─────────────────────────────── */
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "NGLPaper: no CELO balance");
        (bool ok,) = payable(owner).call{value: bal}("");
        require(ok, "NGLPaper: CELO withdraw failed");
        emit Withdrawal(owner, bal, "CELO");
    }

    /* ── Owner: withdraw cUSD ─────────────────────────────── */
    function withdrawCUSD() external onlyOwner {
        uint256 bal = cUSD.balanceOf(address(this));
        require(bal > 0, "NGLPaper: no cUSD balance");
        require(cUSD.transfer(owner, bal), "NGLPaper: cUSD withdraw failed");
        emit Withdrawal(owner, bal, "cUSD");
    }

    /* ── Owner: update prices ─────────────────────────────── */
    /**
     * @param _celo New CELO price per page in wei
     * @param _cusd New cUSD price per page in wei
     */
    function setPrices(uint256 _celo, uint256 _cusd) external onlyOwner {
        pricePerPageCELO = _celo;
        pricePerPageCUSD = _cusd;
        emit PricesUpdated(_celo, _cusd);
    }

    /* ── Owner: transfer ownership ────────────────────────── */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "NGLPaper: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /* ── View: get prices ─────────────────────────────────── */
    function getPrices() external view returns (uint256 celo, uint256 cusd) {
        return (pricePerPageCELO, pricePerPageCUSD);
    }

    /* ── Fallback ─────────────────────────────────────────── */
    receive() external payable {}
}
