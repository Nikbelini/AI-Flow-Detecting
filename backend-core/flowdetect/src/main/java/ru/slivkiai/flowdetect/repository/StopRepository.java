package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;

@Repository
public interface StopRepository extends JpaRepository<StopEntity, Long> {
}
