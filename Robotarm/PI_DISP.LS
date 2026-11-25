/PROG  PI_DISP
/ATTR
COMMENT		= "Pi dispatcher R[100]";
DEFAULT_GROUP	= 1,*,*,*,*;
/MN
   1:  !Pi writes a program number in R[100] ;
   2:  !R[101] = number running, 0 = idle ;
   3:  R[100]=0    ;
   4:  R[101]=0    ;
   5:  LBL[1] ;
   6:  WAIT R[100]<>0    ;
   7:  R[101]=R[100]    ;
   8:  IF R[101]=1,CALL PI_PING ;
   9:  IF R[101]=2,CALL TEST ;
  10:  IF R[101]=3,CALL CLAUDE_J6 ;
  11:  IF R[101]=4,CALL PRINTER1 ;
  12:  IF R[101]=5,CALL PRINTER2 ;
  13:  IF R[101]=6,CALL PRINTER3 ;
  14:  IF R[101]=7,CALL SHELVE ;
  15:  IF R[101]=9,CALL PI_MOVE ;
  16:  R[101]=0    ;
  17:  R[100]=0    ;
  18:  JMP LBL[1] ;
/END
