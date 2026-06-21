package org.example.service;

import org.example.dtos.TransferDto;
import org.example.entity.Account;
import org.example.entity.TransactionLog;
import org.example.repository.AccountRepository;
import org.example.repository.TransactionLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component("TransactionService")
public class TransactionService implements TransactionServiceinterface {

    private static final Logger logger = LoggerFactory.getLogger(TransactionService.class);

    private final AccountRepository accountRepository;
    private final TransactionLogRepository transactionLogRepository;
    private final RewardServiceInterface rewardService;

    @Autowired
    public TransactionService(AccountRepository accountRepository,
                               TransactionLogRepository transactionLogRepository,
                               RewardServiceInterface rewardService) {
        this.accountRepository = accountRepository;
        this.transactionLogRepository = transactionLogRepository;
        this.rewardService = rewardService;
        logger.info("TransactionService initialized");
    }

   @Override
@Transactional
public void transfer(TransferDto transferDto) {
    String idempotencyKey = UUID.randomUUID().toString();

    TransactionLog transactionLog = new TransactionLog();
    transactionLog.setFromAccountId(transferDto.getFromAccountId());
    transactionLog.setToAccountId(transferDto.getToAccountId());
    transactionLog.setAmount(transferDto.getAmount());
    transactionLog.setIdempotencyKey(idempotencyKey);

    // Self-transfer validation
    if (transferDto.getFromAccountId() == transferDto.getToAccountId()) {
        transactionLog.setStatus("FAILED");
        transactionLog.setFailureReason("Self-transfer not allowed");
        transactionLogRepository.save(transactionLog);
        throw new RuntimeException("Self-transfer not allowed");
    }

    try {

        Account fromAccount = accountRepository.findById(transferDto.getFromAccountId())
                .orElseThrow(() -> new RuntimeException(
                        "Account not found: " + transferDto.getFromAccountId()));

        Account toAccount = accountRepository.findById(transferDto.getToAccountId())
                .orElseThrow(() -> new RuntimeException(
                        "Account not found: " + transferDto.getToAccountId()));

        // Source account status validation
        if (!"ACTIVE".equalsIgnoreCase(fromAccount.getStatus())) {
            transactionLog.setStatus("FAILED");
            transactionLog.setFailureReason("Source account is not active");
            transactionLogRepository.save(transactionLog);

            throw new RuntimeException("Source account is not active");
        }

        // Destination account status validation
        if (!"ACTIVE".equalsIgnoreCase(toAccount.getStatus())) {
            transactionLog.setStatus("FAILED");
            transactionLog.setFailureReason("Destination account is not active");
            transactionLogRepository.save(transactionLog);

            throw new RuntimeException("Destination account is not active");
        }

        // Balance validation
        if (fromAccount.getBalance() >= transferDto.getAmount()) {

            toAccount.credit(transferDto.getAmount());
            fromAccount.debit(transferDto.getAmount());

            accountRepository.save(toAccount);
            accountRepository.save(fromAccount);

            transactionLog.setStatus("SUCCESS");
            TransactionLog saved = transactionLogRepository.save(transactionLog);

            // Reward processing
            rewardService.evaluateAndGrant(saved);

            logger.info(
                    "Transfer successful from account {} to account {}",
                    fromAccount.getId(),
                    toAccount.getId());

        } else {

            transactionLog.setStatus("FAILED");
            transactionLog.setFailureReason("Insufficient balance");
            transactionLogRepository.save(transactionLog);

            logger.error(
                    "Transfer failed — insufficient balance in account {}",
                    fromAccount.getId());

            throw new RuntimeException("Insufficient balance for transfer");
        }

    } catch (RuntimeException ex) {

        if (transactionLog.getStatus() == null) {
            transactionLog.setStatus("FAILED");
            transactionLog.setFailureReason(ex.getMessage());
            transactionLogRepository.save(transactionLog);
        }

        logger.error("Transfer failed: {}", ex.getMessage());
        throw ex;
    }
}
}