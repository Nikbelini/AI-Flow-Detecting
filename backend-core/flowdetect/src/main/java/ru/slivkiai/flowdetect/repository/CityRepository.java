package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.slivkiai.flowdetect.domain.entity.CityEntity;

@Repository
public interface CityRepository extends JpaRepository<CityEntity, Long> {
}
