package ru.slivkiai.flowdetect.exception;

public class ModelingServiceException extends RuntimeException {

    public ModelingServiceException(String message) {
        super(message);
    }

    public ModelingServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
