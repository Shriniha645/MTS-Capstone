package org.example.service;

import org.example.dtos.AccountDto;
import org.example.dtos.CreateAccountDto;
import org.example.entity.Account;
import org.example.entity.User;
import org.example.repository.AccountRepository;
import org.example.repository.UserRepository;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component("AccountService")
public class AccountService implements AccountServiceinterface {
    private static final Logger logger = org.slf4j.LoggerFactory.getLogger("account-service");

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;

    @Autowired
    public AccountService(AccountRepository accountRepository, UserRepository userRepository){
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        logger.info("AccountRepository and UserRepository injected into AccountService");
        logger.info("Repositories initialized");
    }

    @Override
    @Transactional
    public void createAccount(AccountDto account) {

        Account acc = new Account();
        acc.setHolderName(account.getHolderName());
        acc.setBalance(account.getBalance());
        acc.setStatus(account.getStatus() != null ? account.getStatus() : "ACTIVE");
        acc.setLastupdatedAt(LocalDateTime.now());

        accountRepository.save(acc);
    }

    @Transactional
    public void createAccount(CreateAccountDto accountDto) {
        // Create user first
        User user = new User();
        user.setUsername(accountDto.getHolderName());
        user.setPassword(accountDto.getPassword() != null ? accountDto.getPassword() : "");
        User savedUser = userRepository.save(user);

        // Create account with the user reference
        Account acc = new Account();
        acc.setUser(savedUser);
        acc.setHolderName(accountDto.getHolderName());
        acc.setBalance(accountDto.getBalance());
        acc.setStatus(accountDto.getStatus() != null ? accountDto.getStatus() : "ACTIVE");
        acc.setLastupdatedAt(LocalDateTime.now());

        accountRepository.save(acc);
    }

    @Transactional
    public AccountDto getAccount(long id){
        Account account = accountRepository.findById(id).orElseThrow(()-> new RuntimeException("Account not found"));
        return mapToDto(account);
    }

    @Transactional
    public List<AccountDto> getAllAccounts(){
        List<Account> accounts = accountRepository.findAll();
        return accounts.stream().map(this::mapToDto).toList();
    }

    private AccountDto mapToDto(Account account) {
        return new AccountDto(
            account.getId(),
            account.getHolderName(),
            account.getStatus(),
            account.getLastupdatedAt(),
            account.getBalance()
        );
    }

    @Transactional
    public void setPassword(long accountId, String newPassword) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found with id: " + accountId));

        User user = account.getUser();
        user.setPassword(newPassword);
        userRepository.save(user);
        logger.info("Password set for user linked to account id: {}", accountId);
    }

    @Transactional
    public void changePassword(long accountId, String oldPassword, String newPassword) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found with id: " + accountId));

        User user = account.getUser();

        // Verify old password matches
        if (user.getPassword() == null || !user.getPassword().equals(oldPassword)) {
            throw new RuntimeException("Old password is incorrect");
        }

        user.setPassword(newPassword);
        userRepository.save(user);
        logger.info("Password changed for user linked to account id: {}", accountId);
    }
}
