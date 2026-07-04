-- 정회원 등급 일괄 적용 및 임시탈퇴 회원 삭제

-- 남자
update members set grade = 'A' where name in ('남자회원01', '남자회원02', '남자회원05', '남자회원06', '남자회원07', '남자회원09', '남자회원10', '남자회원11') and gender = 'male';
update members set grade = 'B' where name in ('남자회원14', '남자회원12', '남자회원13', '남자회원04') and gender = 'male';
update members set grade = 'C' where name in ('남자회원03', '남자회원08', '남자회원15') and gender = 'male';

-- 여자
update members set grade = 'A' where name in ('여자회원04', '여자회원05') and gender = 'female';
update members set grade = 'B' where name in ('여자회원02', '여자회원08', '여자회원03') and gender = 'female';
update members set grade = 'D' where name in ('여자회원01') and gender = 'female';

-- 임시탈퇴 회원 삭제
delete from members where name = '여자회원06' and gender = 'female';
