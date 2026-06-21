package org.example.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@NoArgsConstructor
@Setter
@Getter
public class JwtTokenDto {
    private String token;
    private String type;
    private long expiresIn;

    public JwtTokenDto(String token) {
        this.token = token;
        this.type = "Bearer";
        this.expiresIn = 3600000; 
    }
}

