package ru.slivkiai.flowdetect.user.exception;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(Long Id) {
        super("User not found: " + Id);
    }
}