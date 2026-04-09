package ru.slivkiai.flowdetect.exception;

public class RoutePlanningException extends RuntimeException {
    
    public RoutePlanningException(String message) {
        super(message);
    }
    
    public RoutePlanningException(String message, Throwable cause) {
        super(message, cause);
    }
}
