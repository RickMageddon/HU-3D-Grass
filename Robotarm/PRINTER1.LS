/PROG  PRINTER1
/ATTR
COMMENT		= "FILLER J1 to 50";
DEFAULT_GROUP	= 1,*,*,*,*;
/MN
   1:  !Filler: only J1 to 50 deg ;
   2:  !replace with taught points ;
   3:  PR[2]=JPOS    ;
   4:  PR[2,1]=50    ;
   5:J PR[2] 30% FINE    ;
/END
